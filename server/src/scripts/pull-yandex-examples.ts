import { eq } from 'drizzle-orm';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { words, wordMeanings } from '../db/schema.js';
import { lookup } from '../services/dictionary-service.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

async function pullForWord(text: string) {
  const [word] = await db.select().from(words).where(eq(words.text, text)).limit(1);
  if (!word) {
    console.log(`[${text}] not found in DB, skipping`);
    return;
  }

  console.log(`[${text}] fetching from Yandex (skipCache)...`);
  const result = await lookup(text, { skipCache: true });
  if (result.meanings.length === 0) {
    console.log(`  → no results from API`);
    return;
  }

  const existing = await db.select().from(wordMeanings).where(eq(wordMeanings.wordId, word.id));

  let updated = 0;
  let withExamples = 0;

  for (const m of result.meanings) {
    if (m.examples.length > 0) withExamples++;

    const row = existing.find((e) => e.translation === m.translation);
    if (!row) continue;

    const updates: Record<string, unknown> = {};
    if (!row.contextExample && m.examples.length > 0) {
      updates.contextExample = m.examples[0]!.text;
    }
    if (!row.examples && m.examples.length > 0) {
      updates.examples = m.examples;
    }
    if (!row.meaningHints && m.meaningHints.length > 0) {
      updates.meaningHints = m.meaningHints;
    }
    if (!row.synonyms && m.synonyms.length > 0) {
      updates.synonyms = m.synonyms;
    }
    if (!row.translationPartOfSpeech && m.translationPartOfSpeech) {
      updates.translationPartOfSpeech = m.translationPartOfSpeech;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(wordMeanings).set(updates).where(eq(wordMeanings.id, row.id));
      updated++;
    }
  }

  console.log(`  → API returned ${result.meanings.length} meanings (${withExamples} with examples), updated ${updated} DB rows`);
}

async function main() {
  const targets = process.argv.slice(2);
  if (targets.length === 0) {
    console.error('Usage: tsx pull-yandex-examples.ts <word1> [word2] ...');
    process.exit(1);
  }

  for (const w of targets) {
    await pullForWord(w);
    await new Promise((r) => setTimeout(r, 300));
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
