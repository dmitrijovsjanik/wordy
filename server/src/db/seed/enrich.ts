import { eq, isNull, sql } from 'drizzle-orm';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { words, wordMeanings } from '../schema.js';
import { lookup } from '../../services/dictionary-service.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1';

function rankToCefr(rank: number | null): CefrLevel {
  if (rank === null) return 'b1';
  if (rank <= 500) return 'a1';
  if (rank <= 1200) return 'a2';
  if (rank <= 2000) return 'b1';
  return 'b2';
}

function rankToDifficulty(rank: number | null): 'easy' | 'medium' | 'hard' {
  if (rank === null) return 'medium';
  if (rank <= 500) return 'easy';
  if (rank <= 1500) return 'medium';
  return 'hard';
}

async function enrich() {
  // Флаг: обогащать только слова без meanings (по умолчанию) или все
  const onlyEmpty = !process.argv.includes('--all');

  let allWords;
  if (onlyEmpty) {
    // Слова без meanings — ещё не обогащённые
    const withMeanings = db
      .select({ wordId: wordMeanings.wordId })
      .from(wordMeanings)
      .groupBy(wordMeanings.wordId);

    allWords = await db
      .select()
      .from(words)
      .where(
        sql`${words.id} NOT IN (SELECT ${wordMeanings.wordId} FROM ${wordMeanings})`,
      );

    console.log(`Enriching ${allWords.length} words without meanings...\n`);
  } else {
    allWords = await db.select().from(words);
    console.log(`Enriching ALL ${allWords.length} words...\n`);
  }

  if (allWords.length === 0) {
    console.log('No words to enrich.');
    await pool.end();
    return;
  }

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i];
    const progress = `[${i + 1}/${allWords.length}]`;

    try {
      console.log(`${progress} [${word.text}] Looking up...`);
      const result = await lookup(word.text);

      if (result.meanings.length === 0) {
        console.log(`  → No results from dictionary, skipping`);
        skipped++;
        continue;
      }

      const existingMeanings = await db
        .select()
        .from(wordMeanings)
        .where(eq(wordMeanings.wordId, word.id));

      const cefr = rankToCefr(word.frequencyRank);
      const difficulty = rankToDifficulty(word.frequencyRank);
      let added = 0;
      let updated = 0;

      for (let idx = 0; idx < result.meanings.length; idx++) {
        const m = result.meanings[idx]!;
        const popularityRank = idx + 1; // 1 = самый популярный

        const existing = existingMeanings.find(
          (e) => e.translation === m.translation,
        );

        if (existing) {
          // Обновляем contextExample, cefr и popularityRank если их не было
          const updates: Record<string, unknown> = {};
          if (!existing.contextExample && m.examples.length > 0) {
            updates.contextExample = m.examples[0]!.text;
          }
          if (!existing.cefr) {
            updates.cefr = cefr;
          }
          if (existing.popularityRank === null) {
            updates.popularityRank = popularityRank;
          }
          if (Object.keys(updates).length > 0) {
            await db
              .update(wordMeanings)
              .set(updates)
              .where(eq(wordMeanings.id, existing.id));
            updated++;
          }
        } else {
          await db.insert(wordMeanings).values({
            wordId: word.id,
            translation: m.translation,
            partOfSpeech: m.partOfSpeech as 'noun' | 'verb' | 'adj' | 'adv' | 'phrase',
            contextExample: m.examples[0]?.text ?? null,
            difficulty,
            cefr,
            popularityRank,
          });
          added++;
        }
      }

      console.log(`  → ${added} new meanings, ${updated} updated`);
      enriched++;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`  → ERROR: ${err instanceof Error ? err.message : err}`);
      failed++;
      // Продолжаем после ошибки
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone! Enriched: ${enriched}, Skipped: ${skipped}, Failed: ${failed}`);
  await pool.end();
}

enrich().catch((err) => {
  console.error('Enrich failed:', err);
  process.exit(1);
});
