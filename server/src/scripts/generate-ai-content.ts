/**
 * Генерация AI-контента для word_meanings через Anthropic API.
 *
 * 5 типов контента per meaning:
 *   1. examples       — 3 предложения (A1, B1, C1) с переводами
 *   2. mnemonic       — русская звуковая ассоциация
 *   3. hints          — 3 подсказки (категория → фонетика → пропуски)
 *   4. grammar        — грамматические правила
 *   5. common_errors  — частые ошибки русскоязычных
 *
 * Запускать: cd server && npm run ai:generate -- --limit=1000
 *
 * Env: DATABASE_URL, ANTHROPIC_API_KEY
 * Флаги:
 *   --limit=N        максимум meanings (по умолчанию 500)
 *   --batch=N        meanings per API call (по умолчанию 20)
 *   --concurrency=N  параллельных запросов (по умолчанию 3)
 *   --offset=N       пропустить первые N необработанных
 */

import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';

// ─── CLI args ────────────────────────────────────────────────────────────────
function getArg(name: string, defaultValue: number): number {
  const arg = process.argv.find(a => a.startsWith(`--${name}=`));
  return arg ? Number(arg.split('=')[1]) : defaultValue;
}

const LIMIT = getArg('limit', 500);
const BATCH_SIZE = getArg('batch', 20);
const CONCURRENCY = getArg('concurrency', 3);
const OFFSET = getArg('offset', 0);

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

// ─── Prompt ──────────────────────────────────────────────────────────────────
function buildPrompt(meanings: MeaningRow[]): string {
  const list = meanings.map(m =>
    `- id=${m.meaningId} word="${m.word}" translation="${m.translation}" pos=${m.pos}`
  ).join('\n');

  return `Ты — помощник для приложения изучения английского языка для русскоязычных пользователей.

Для каждого meaning ниже сгенерируй 5 типов контента:

1. **examples** — 3 предложения с этим словом В ДАННОМ ЗНАЧЕНИИ (a1=простое, b1=среднее, c1=сложное). Каждое с переводом на русский.

2. **mnemonic** — русская звуковая ассоциация. Формат: "WORD — звучит как «созвучие». Ассоциация с ПЕРЕВОДОМ." Помогает запомнить ПЕРЕВОД через созвучие.

3. **hints** — 3 подсказки для угадывания слова (без прямого перевода):
   - level 1: категория/контекст ("Глагол движения", "Предлог места")
   - level 2: фонетическая подсказка ("4 буквы, начинается на R")
   - level 3: слово с пропусками ("R _ n")

4. **grammar** — 2-3 грамматических правила для этого слова. Примеры: неправильные формы глагола, предлоги после слова, типичные конструкции, отличия от похожих слов. Каждое правило с примером.

5. **common_errors** — 2-3 частые ошибки русскоязычных при использовании этого слова. Что пишут неправильно, как правильно, почему.

ВАЖНО:
- Примеры — ИМЕННО в указанном значении (translation)
- Мнемоника — на русском, через созвучие
- Подсказки — НЕ содержат перевод
- Грамматика и ошибки — с точки зрения русскоязычного ученика

Meanings:
${list}

Ответ строго в JSON — массив объектов:
[
  {
    "meaningId": <number>,
    "examples": { "sentences": [
      { "en": "...", "ru": "...", "cefr": "a1" },
      { "en": "...", "ru": "...", "cefr": "b1" },
      { "en": "...", "ru": "...", "cefr": "c1" }
    ]},
    "mnemonic": { "association": "..." },
    "hints": { "hints": [
      { "level": 1, "text": "..." },
      { "level": 2, "text": "..." },
      { "level": 3, "text": "..." }
    ]},
    "grammar": { "rules": [
      { "rule": "...", "example": "..." }
    ]},
    "common_errors": { "errors": [
      { "wrong": "...", "correct": "...", "explanation": "..." }
    ]}
  }
]

Только JSON, без markdown-обёртки, без комментариев.`;
}

// ─── Extract JSON from response ──────────────────────────────────────────────
function extractJson(text: string): string {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) return jsonMatch[0];
  return text.trim();
}

// ─── Content types ───────────────────────────────────────────────────────────
const CONTENT_TYPES = ['examples', 'mnemonic', 'hints', 'grammar', 'common_errors'] as const;

// ─── Process one batch ───────────────────────────────────────────────────────
async function processBatch(
  anthropic: Anthropic,
  dbClient: pg.PoolClient,
  batch: MeaningRow[],
  batchNum: number,
  totalBatches: number,
): Promise<{ inserted: number; errors: number }> {
  const label = batch.map(m => `${m.word}(${m.translation})`).join(', ');
  console.log(`  Batch ${batchNum}/${totalBatches}: ${label}`);

  try {
    const prompt = buildPrompt(batch);
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonText = extractJson(text);

    let generated: GeneratedContent[];
    try {
      generated = JSON.parse(jsonText);
    } catch {
      console.error(`    Batch ${batchNum}: JSON parse error, skipping`);
      console.error(`    Preview: ${text.slice(0, 150)}`);
      return { inserted: 0, errors: batch.length };
    }

    let inserted = 0;
    let errors = 0;

    for (const item of generated) {
      const meaning = batch.find(m => m.meaningId === item.meaningId);
      if (!meaning) {
        console.error(`    Unknown meaningId ${item.meaningId}`);
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
        console.error(`    DB error for ${meaning.word}(${meaning.translation}):`, err);
        errors++;
      }
    }

    console.log(`    Batch ${batchNum}: OK (${inserted}/${batch.length})`);
    return { inserted, errors };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`    Batch ${batchNum}: API error — ${msg}`);
    return { inserted: 0, errors: batch.length };
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const anthropic = new Anthropic();
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
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
    console.log(`Found ${meanings.length} meanings (offset=${OFFSET}, limit=${LIMIT}, concurrency=${CONCURRENCY})`);

    if (meanings.length === 0) {
      console.log('Nothing to do.');
      return;
    }

    // Split into batches
    const batches: MeaningRow[][] = [];
    for (let i = 0; i < meanings.length; i += BATCH_SIZE) {
      batches.push(meanings.slice(i, i + BATCH_SIZE));
    }

    let totalInserted = 0;
    let totalErrors = 0;

    // Process with concurrency
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY);
      console.log(`\n--- Parallel group ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(batches.length / CONCURRENCY)} (batches ${i + 1}-${i + chunk.length}/${batches.length}) ---`);

      const results = await Promise.all(
        chunk.map((batch, j) =>
          processBatch(anthropic, client, batch, i + j + 1, batches.length)
        ),
      );

      for (const r of results) {
        totalInserted += r.inserted;
        totalErrors += r.errors;
      }

      // Small delay between parallel groups to avoid rate limits
      if (i + CONCURRENCY < batches.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`\n=== Done: ${totalInserted} inserted, ${totalErrors} errors ===`);

    const stats = await client.query(
      `SELECT content_type, count(*) as cnt FROM word_ai_content GROUP BY content_type ORDER BY content_type`,
    );
    console.log('\nDB stats:');
    for (const row of stats.rows) {
      console.log(`  ${row.content_type}: ${row.cnt}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
