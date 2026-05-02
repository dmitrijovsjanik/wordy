/**
 * Генерация AI-контента для word_meanings через OpenAI Batch API.
 *
 * Почему Batch API, а не sync chat completions:
 *   GPT-5 — reasoning model. На один батч из 20 meanings reasoning
 *   tokens могут идти 5+ минут. На длинных синхронных TLS-соединениях
 *   ловим ECONNRESET от прокси/балансировщика. Batch API уходит этой
 *   проблемы — нет открытого соединения, OpenAI обрабатывает на своей
 *   стороне (до 24h SLA, обычно быстрее), плюс 50% скидка.
 *
 * 5 типов контента per meaning:
 *   examples, mnemonic, hints, grammar, common_errors.
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
  examples: { sentences: Array<{ en: string; ru: string; cefr: string }> };
  mnemonic: { association: string };
  hints: { hints: Array<{ level: number; text: string }> };
  grammar: { rules: Array<{ rule: string; example: string }> };
  common_errors: { errors: Array<{ wrong: string; correct: string; explanation: string }> };
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
const SYSTEM_PROMPT = `Ты — помощник для приложения изучения английского языка для русскоязычных пользователей. Тебе дают список английских meaning'ов (слово + конкретный перевод + часть речи), и для каждого ты генерируешь 5 типов учебного контента строго по нижеуказанному формату.

Контент для каждого meaning:

1. **examples** — три предложения с этим словом ИМЕННО в указанном значении (translation). Уровни сложности:
   - a1: простое, бытовое, короткое
   - b1: среднее, повседневная речь, естественное
   - c1: сложное, идиоматичное или с продвинутой грамматикой
   Каждое предложение с переводом на русский. Перевод должен быть естественным, не подстрочным.

2. **mnemonic** — русская звуковая ассоциация для запоминания ПЕРЕВОДА через созвучие.
   Формат: "WORD — звучит как «созвучие». Ассоциация с ПЕРЕВОДОМ."
   Пример для "run/бежать": "RUN — звучит как «ран». Утренний забег — рана на коленке от падения."
   Мнемоника должна быть запоминающейся, образной, на русском.

3. **hints** — 3 подсказки для угадывания слова, БЕЗ прямого перевода:
   - level 1: категория или семантический контекст ("Глагол движения", "Существительное-инструмент", "Предлог места")
   - level 2: фонетическая или морфологическая ("4 буквы, начинается на R", "Глагол на -ing форму")
   - level 3: слово с пропусками ("R _ n", "p_p_l_")

4. **grammar** — 2-3 грамматических правила для этого слова. Что важно знать русскоязычному ученику:
   - Неправильные формы глагола (если глагол)
   - Какие предлоги идут после
   - Типичные синтаксические конструкции
   - Отличия от похожих слов
   Каждое правило с минимальным примером.

5. **common_errors** — 2-3 частые ошибки русскоязычных при использовании этого слова. Структура:
   - wrong: неправильный вариант (как часто пишут)
   - correct: правильный
   - explanation: почему так, кратко

ВАЖНЫЕ ТРЕБОВАНИЯ:
- Примеры строго в значении translation (для слова с polysemy — НЕ путать значения)
- Мнемоника на русском, через звуковое созвучие
- Подсказки НЕ должны содержать перевод
- Грамматика и ошибки — с точки зрения русскоязычного ученика английского
- Никакой markdown-обёртки, эмодзи, лирических отступлений

ФОРМАТ ОТВЕТА:
Строго JSON-объект с ключом "items" — массивом объектов по одному на каждый meaningId из ввода.

Пример ввода:
- id=42 word="run" translation="бежать" pos=verb

Пример ответа:
{
  "items": [
    {
      "meaningId": 42,
      "examples": {
        "sentences": [
          { "en": "I run every morning.", "ru": "Я бегаю каждое утро.", "cefr": "a1" },
          { "en": "She runs three miles before work.", "ru": "Она пробегает три мили до работы.", "cefr": "b1" },
          { "en": "He's been running marathons for over a decade.", "ru": "Он бегает марафоны уже больше десяти лет.", "cefr": "c1" }
        ]
      },
      "mnemonic": { "association": "RUN — звучит как «ран». Утренний забег — рана на коленке от падения." },
      "hints": {
        "hints": [
          { "level": 1, "text": "Глагол движения" },
          { "level": 2, "text": "3 буквы, начинается на R" },
          { "level": 3, "text": "R _ n" }
        ]
      },
      "grammar": {
        "rules": [
          { "rule": "Неправильный глагол: run/ran/run", "example": "I ran yesterday." },
          { "rule": "Present Continuous требует -ing: running", "example": "She is running now." }
        ]
      },
      "common_errors": {
        "errors": [
          { "wrong": "I am run", "correct": "I run / I am running", "explanation": "After 'am' нужна -ing форма." }
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

const CONTENT_TYPES = ['examples', 'mnemonic', 'hints', 'grammar', 'common_errors'] as const;

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
      const res = await client.query(`
        SELECT wm.id as "meaningId", w.text as word, wm.translation,
               wm.part_of_speech as pos, w.frequency_rank as "freqRank"
        FROM word_meanings wm
        JOIN words w ON wm.word_id = w.id
        WHERE wm.popularity_rank <= 3
          AND (wm.frequency >= 5 OR wm.frequency IS NULL)
          AND NOT EXISTS (
            SELECT 1 FROM word_ai_content wac
            WHERE wac.meaning_id = wm.id AND wac.content_type = 'grammar'
          )
        ORDER BY w.frequency_rank ASC NULLS LAST, wm.popularity_rank ASC
        OFFSET $1 LIMIT $2
      `, [OFFSET, LIMIT]);
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
    const res = await client.query(`
      SELECT wm.id as "meaningId", w.text as word, wm.translation,
             wm.part_of_speech as pos, w.frequency_rank as "freqRank"
      FROM word_meanings wm
      JOIN words w ON wm.word_id = w.id
      WHERE wm.popularity_rank <= 3
        AND (wm.frequency >= 5 OR wm.frequency IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM word_ai_content wac
          WHERE wac.meaning_id = wm.id AND wac.content_type = 'grammar'
        )
      ORDER BY w.frequency_rank ASC NULLS LAST, wm.popularity_rank ASC
      OFFSET $1 LIMIT $2
    `, [OFFSET, LIMIT]);

    const meanings: MeaningRow[] = res.rows;
    console.log(`Found ${meanings.length} meanings (offset=${OFFSET}, limit=${LIMIT}, batch=${BATCH_SIZE}, model=${MODEL})`);

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
