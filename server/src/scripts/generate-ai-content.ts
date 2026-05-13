/**
 * Генерация AI-примеров для word_meanings через OpenAI Batch API.
 *
 * Почему Batch API, а не sync chat completions:
 *   GPT-5 — reasoning model. На один батч из 20 meanings reasoning
 *   tokens могут идти 5+ минут. На длинных синхронных TLS-соединениях
 *   ловим ECONNRESET от прокси/балансировщика. Batch API уходит этой
 *   проблемы — нет открытого соединения, OpenAI обрабатывает на своей
 *   стороне (до 24h SLA, обычно быстрее), плюс 50% скидка.
 *
 * Генерим только examples (по 1 предложению на миннинг).
 * Раньше скрипт делал 5 типов контента (mnemonic/hints/grammar/common_errors),
 * но они не использовались в UI. Глагольные формы берутся через `compromise`
 * library (см. word-forms-service.ts), AI grammar дублировал это.
 *
 * Pipeline:
 *   1. SELECT meanings без grammar в word_ai_content
 *   2. Группируем по BATCH_SIZE meanings в один chat completion request
 *   3. Формируем .jsonl: одна строка = один request с custom_id для маппинга
 *   4. Upload через Files API (purpose: 'batch')
 *   5. Create batch (endpoint: /v1/chat/completions)
 *   6. Polling статуса каждые POLL_INTERVAL_SEC секунд
 *   7. Download output, парсинг, запись в word_ai_content
 *
 * Запускать (создание + ожидание + сохранение):
 *   cd server && npm run ai:generate -- --limit=2000 --batch=20
 *
 * Resume существующего батча (если упало после create):
 *   npm run ai:generate -- --batch-id=batch_xxx
 *
 * Env: DATABASE_URL, OPENAI_API_KEY
 * Флаги:
 *   --limit=N        максимум meanings (по умолчанию 500)
 *   --batch=N        meanings per chat completion request (по умолчанию 20)
 *   --offset=N       пропустить первые N необработанных
 *   --model=NAME     модель OpenAI (по умолчанию gpt-5)
 *   --batch-id=xxx   resume существующего batch (пропускает create, идёт сразу на polling)
 *   --dry            не создавать batch, только сформировать .jsonl и показать его путь
 */

import pg from 'pg';
import OpenAI from 'openai';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ─── CLI args ────────────────────────────────────────────────────────────────
function getArg(name: string, defaultValue: number): number {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? Number(arg.split('=')[1]) : defaultValue;
}
function getStringArg(name: string, defaultValue: string | undefined): string | undefined {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : defaultValue;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const LIMIT = getArg('limit', 500);
const BATCH_SIZE = getArg('batch', 20);
const OFFSET = getArg('offset', 0);
const MODEL = getStringArg('model', 'gpt-5')!;
const RESUME_BATCH_ID = getStringArg('batch-id', undefined);
const DRY = hasFlag('dry');
const POLL_INTERVAL_SEC = 60;
// Reasoning model: бюджет включает reasoning + output. На smoke-тесте при
// 8000 токенов модель потратила ВСЁ на reasoning и не успела вывести JSON.
// 50000 даёт запас на reasoning + 20 meanings × ~600 output токенов.
// Платим только за реально использованные — Batch API + 50% скидка.
const MAX_COMPLETION_TOKENS = 50000;

// ─── Types ───────────────────────────────────────────────────────────────────
type MeaningRow = {
  meaningId: number;
  word: string;
  translation: string;
  pos: string;
  freqRank: number;
};

type GeneratedContent = {
  meaningId: number;
  examples: { sentences: Array<{ en: string; ru: string }> };
};

type BatchOutputLine = {
  id: string;
  custom_id: string;
  response?: {
    status_code: number;
    request_id: string;
    body: {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        prompt_tokens_details?: { cached_tokens?: number };
        completion_tokens_details?: { reasoning_tokens?: number };
      };
    };
  };
  error?: { code: string; message: string };
};

// ─── System prompt (статичный, кэшируемый) ──────────────────────────────────
const SYSTEM_PROMPT = `Ты — помощник для приложения изучения английского языка для русскоязычных пользователей. Тебе дают список английских meaning'ов (слово + конкретный перевод + часть речи). Для каждого нужно сгенерировать ОДНО example-предложение.

Требования к примеру:
- Уровень сложности B1: повседневная речь, естественное, 5-12 слов.
- Слово должно использоваться ИМЕННО в указанном значении (translation). У слов с polysemy НЕ путать смыслы.
- С переводом на русский — естественным, не подстрочным.
- Никакой markdown-обёртки, эмодзи, лирических отступлений.

ФОРМАТ ОТВЕТА:
Строго JSON-объект с ключом "items" — массивом объектов по одному на каждый meaningId из ввода.

Пример ввода:
- id=42 word="run" translation="бежать" pos=verb
- id=43 word="leave" translation="оставить" pos=verb

Пример ответа:
{
  "items": [
    {
      "meaningId": 42,
      "examples": {
        "sentences": [
          { "en": "She runs three miles before work.", "ru": "Она пробегает три мили до работы." }
        ]
      }
    },
    {
      "meaningId": 43,
      "examples": {
        "sentences": [
          { "en": "Leave the keys on the table.", "ru": "Оставь ключи на столе." }
        ]
      }
    }
  ]
}

Возвращай ТОЛЬКО JSON, без markdown.`;

function buildUserPrompt(meanings: MeaningRow[]): string {
  const list = meanings.map(m =>
    `- id=${m.meaningId} word="${m.word}" translation="${m.translation}" pos=${m.pos}`
  ).join('\n');
  return `Сгенерируй контент для meaning'ов:\n${list}`;
}

const CONTENT_TYPES = ['examples'] as const;

// Фильтр eligible-миннингов — совпадает с тем что использует учебный поток
// (см. [[project-meaning-filter]]): freq>=5 AND rank<=3, однословные,
// служебные слова и POS исключены.
//
// Берём только те, у которых пусто И в word_meanings.examples/context_example
// (Yandex/Tatoeba), И в word_ai_content (AI). Иначе перетёрли бы существующий
// источник.
//
// Сортировка rank-first: сначала ВСЕ rank=1 миннинги в порядке частоты слова,
// потом rank=2, потом rank=3. Гарантирует что бюджет тратится максимально
// широко — каждое слово получит хотя бы один пример прежде чем перейдём
// ко вторым и третьим переводам.
const ELIGIBLE_MEANINGS_SQL = `
  SELECT wm.id as "meaningId", w.text as word, wm.translation,
         wm.part_of_speech as pos, w.frequency_rank as "freqRank"
  FROM word_meanings wm
  JOIN words w ON wm.word_id = w.id
  WHERE wm.popularity_rank <= 3
    AND wm.frequency >= 5
    AND w.text NOT LIKE '% %'
    AND w.text NOT IN ('a', 'an', 'the')
    AND (
      wm.translation_part_of_speech IS NULL
      OR wm.translation_part_of_speech NOT IN (
        'preposition', 'conjunction', 'particle', 'interjection',
        'parenthetic', 'invariable', 'adverbial participle'
      )
    )
    AND wm.context_example IS NULL
    AND (wm.examples IS NULL OR jsonb_array_length(wm.examples) = 0)
    AND NOT EXISTS (
      SELECT 1 FROM word_ai_content wac
      WHERE wac.meaning_id = wm.id AND wac.content_type = 'examples'
    )
  ORDER BY wm.popularity_rank ASC, w.frequency_rank ASC NULLS LAST
  OFFSET $1 LIMIT $2
`;

// ─── Build .jsonl input file ────────────────────────────────────────────────
function buildBatchInput(meanings: MeaningRow[]): { jsonlPath: string; meaningsByCustomId: Map<string, MeaningRow[]> } {
  const meaningsByCustomId = new Map<string, MeaningRow[]>();
  const lines: string[] = [];

  for (let i = 0; i < meanings.length; i += BATCH_SIZE) {
    const chunk = meanings.slice(i, i + BATCH_SIZE);
    const customId = `meanings-${i}-${i + chunk.length - 1}`;
    meaningsByCustomId.set(customId, chunk);

    const line = {
      custom_id: customId,
      method: 'POST',
      url: '/v1/chat/completions',
      body: {
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(chunk) },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: MAX_COMPLETION_TOKENS,
      },
    };
    lines.push(JSON.stringify(line));
  }

  const tmpDir = os.tmpdir();
  const jsonlPath = path.join(tmpDir, `wordy-ai-batch-${Date.now()}.jsonl`);
  fs.writeFileSync(jsonlPath, lines.join('\n') + '\n');

  return { jsonlPath, meaningsByCustomId };
}

// ─── Polling ────────────────────────────────────────────────────────────────
async function pollUntilDone(openai: OpenAI, batchId: string): Promise<OpenAI.Batches.Batch> {
  while (true) {
    const batch = await openai.batches.retrieve(batchId);
    const counts = batch.request_counts;
    const elapsed = batch.in_progress_at
      ? Math.round((Date.now() - batch.in_progress_at * 1000) / 1000)
      : 0;
    console.log(
      `  status=${batch.status}, completed=${counts?.completed ?? 0}/${counts?.total ?? '?'}, failed=${counts?.failed ?? 0}, elapsed=${elapsed}s`,
    );

    if (batch.status === 'completed') return batch;
    if (batch.status === 'failed' || batch.status === 'expired' || batch.status === 'cancelled') {
      throw new Error(`Batch ${batch.status}: ${JSON.stringify(batch.errors)}`);
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_SEC * 1000));
  }
}

// ─── Save results from output .jsonl ────────────────────────────────────────
async function saveResults(
  outputContent: string,
  meaningsByCustomId: Map<string, MeaningRow[]>,
  dbClient: pg.PoolClient,
): Promise<{ inserted: number; errors: number; cachedRatio: number }> {
  let inserted = 0;
  let errors = 0;
  let totalPromptTokens = 0;
  let totalCachedTokens = 0;
  let totalCompletionTokens = 0;
  let totalReasoningTokens = 0;

  const lines = outputContent.split('\n').filter(l => l.trim());

  for (const line of lines) {
    let parsed: BatchOutputLine;
    try {
      parsed = JSON.parse(line);
    } catch {
      console.error(`  Skip non-JSON output line`);
      continue;
    }

    const meanings = meaningsByCustomId.get(parsed.custom_id) ?? [];
    if (meanings.length === 0) {
      console.error(`  Unknown custom_id ${parsed.custom_id}`);
      continue;
    }

    if (parsed.error || !parsed.response) {
      console.error(`  ${parsed.custom_id}: ${parsed.error?.code} ${parsed.error?.message}`);
      errors += meanings.length;
      continue;
    }

    const usage = parsed.response.body.usage;
    if (usage) {
      totalPromptTokens += usage.prompt_tokens;
      totalCompletionTokens += usage.completion_tokens;
      totalCachedTokens += usage.prompt_tokens_details?.cached_tokens ?? 0;
      totalReasoningTokens += usage.completion_tokens_details?.reasoning_tokens ?? 0;
    }

    const text = parsed.response.body.choices[0]?.message?.content ?? '';
    if (!text) {
      console.error(`  ${parsed.custom_id}: empty content`);
      errors += meanings.length;
      continue;
    }

    let body: { items?: GeneratedContent[] } | GeneratedContent[];
    try {
      body = JSON.parse(text);
    } catch {
      console.error(`  ${parsed.custom_id}: JSON parse failed`);
      console.error(`  preview: ${text.slice(0, 200)}`);
      errors += meanings.length;
      continue;
    }

    const items: GeneratedContent[] = Array.isArray(body) ? body : (body.items ?? []);
    if (items.length === 0) {
      console.error(`  ${parsed.custom_id}: no items in response`);
      errors += meanings.length;
      continue;
    }

    for (const item of items) {
      const meaning = meanings.find(m => m.meaningId === item.meaningId);
      if (!meaning) {
        console.error(`  ${parsed.custom_id}: unknown meaningId ${item.meaningId}`);
        errors++;
        continue;
      }
      try {
        for (const type of CONTENT_TYPES) {
          const content = item[type];
          if (!content) continue;
          await dbClient.query(
            `INSERT INTO word_ai_content (meaning_id, content_type, content)
             VALUES ($1, $2, $3)
             ON CONFLICT (meaning_id, content_type) DO UPDATE SET content = $3`,
            [item.meaningId, type, JSON.stringify(content)],
          );
        }
        inserted++;
      } catch (err) {
        console.error(`  DB error ${meaning.word}(${meaning.translation}):`, err);
        errors++;
      }
    }
  }

  const cachedRatio = totalPromptTokens > 0
    ? Math.round((totalCachedTokens / totalPromptTokens) * 100)
    : 0;

  console.log(`\n  Tokens: prompt=${totalPromptTokens} (cached ${totalCachedTokens}, ${cachedRatio}%), completion=${totalCompletionTokens} (reasoning ${totalReasoningTokens})`);
  return { inserted, errors, cachedRatio };
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  const openai = new OpenAI();
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    // ─── Resume mode ────────────────────────────────────────────────────────
    if (RESUME_BATCH_ID) {
      console.log(`Resume mode: batch_id=${RESUME_BATCH_ID}`);
      const batch = await openai.batches.retrieve(RESUME_BATCH_ID);
      console.log(`  Current status: ${batch.status}`);

      // Чтобы маппить custom_id обратно в meanings — пересоздаём ту же выборку.
      // Это работает, если БД не изменилась между create и resume.
      const res = await client.query(ELIGIBLE_MEANINGS_SQL, [OFFSET, LIMIT]);
      const meanings: MeaningRow[] = res.rows;
      const meaningsByCustomId = new Map<string, MeaningRow[]>();
      for (let i = 0; i < meanings.length; i += BATCH_SIZE) {
        const chunk = meanings.slice(i, i + BATCH_SIZE);
        meaningsByCustomId.set(`meanings-${i}-${i + chunk.length - 1}`, chunk);
      }

      const completed = batch.status === 'completed' ? batch : await pollUntilDone(openai, RESUME_BATCH_ID);
      if (!completed.output_file_id) throw new Error('No output_file_id');

      console.log(`Downloading output ${completed.output_file_id}...`);
      const outputResp = await openai.files.content(completed.output_file_id);
      const outputContent = await outputResp.text();
      const result = await saveResults(outputContent, meaningsByCustomId, client);
      console.log(`\n=== Done: ${result.inserted} inserted, ${result.errors} errors ===`);
      await printDbStats(client);
      return;
    }

    // ─── Fresh run ──────────────────────────────────────────────────────────
    const res = await client.query(ELIGIBLE_MEANINGS_SQL, [OFFSET, LIMIT]);

    const meanings: MeaningRow[] = res.rows;
    console.log(`Found ${meanings.length} meanings (offset=${OFFSET}, limit=${LIMIT}, batch=${BATCH_SIZE}, model=${MODEL})`);
    console.log(`Filter: frequency>=5 AND popularity_rank<=3, single-word, non-functional, no AI-grammar yet`);

    if (meanings.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    const { jsonlPath, meaningsByCustomId } = buildBatchInput(meanings);
    const requestCount = meaningsByCustomId.size;
    const fileSize = fs.statSync(jsonlPath).size;
    console.log(`Built ${jsonlPath}: ${requestCount} requests, ${(fileSize / 1024).toFixed(1)}KB`);

    if (DRY) {
      console.log('Dry mode — exiting before upload.');
      return;
    }

    console.log('Uploading input file...');
    const file = await openai.files.create({
      file: fs.createReadStream(jsonlPath),
      purpose: 'batch',
    });
    console.log(`  file_id=${file.id}`);

    console.log('Creating batch...');
    const batch = await openai.batches.create({
      input_file_id: file.id,
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
    });
    console.log(`  batch_id=${batch.id}, status=${batch.status}`);
    console.log(`\n  Resume command if this script dies:`);
    console.log(`    npm run ai:generate -- --batch-id=${batch.id} --limit=${LIMIT} --offset=${OFFSET} --batch=${BATCH_SIZE}\n`);

    console.log('Polling status (every 60s, may take up to 24h)...');
    const completed = await pollUntilDone(openai, batch.id);
    if (!completed.output_file_id) throw new Error('No output_file_id after completion');

    console.log(`Downloading output ${completed.output_file_id}...`);
    const outputResp = await openai.files.content(completed.output_file_id);
    const outputContent = await outputResp.text();

    const result = await saveResults(outputContent, meaningsByCustomId, client);
    console.log(`\n=== Done: ${result.inserted} inserted, ${result.errors} errors ===`);
    await printDbStats(client);
  } finally {
    client.release();
    await pool.end();
  }
}

async function printDbStats(client: pg.PoolClient) {
  const stats = await client.query(
    `SELECT content_type, count(*) as cnt FROM word_ai_content GROUP BY content_type ORDER BY content_type`,
  );
  console.log('\nDB stats:');
  for (const row of stats.rows) {
    console.log(`  ${row.content_type}: ${row.cnt}`);
  }
}

main().catch(console.error);
