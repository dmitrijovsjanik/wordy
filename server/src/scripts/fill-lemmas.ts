// Fills `words.lemma` for rows where it is NULL.
//
// Strategy:
//   - For each word with NULL lemma, infer POS from the most common
//     `partOfSpeech` of its `word_meanings`.
//   - For phrase / multi-word entries — store the original (lower-cased) text;
//     wink-lemmatizer is single-word only.
//   - For noun/verb/adj — call the corresponding wink-lemmatizer function.
//   - For adv (or unknown) — store the lower-cased text as-is.
//   - Always write a non-NULL value: NULL is the "needs processing" signal,
//     so even idempotent no-ops persist a value (the input itself).
//
// Idempotent: re-running the script processes only rows that are still NULL.
//
// Usage:
//   npm run db:fill-lemmas

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { words, wordMeanings } from '../db/schema.js';
// wink-lemmatizer ships no .d.ts; minimal inline typing.
import lemmatizer from 'wink-lemmatizer';

type WinkLemmatizer = {
  noun: (w: string) => string;
  verb: (w: string) => string;
  adjective: (w: string) => string;
};
const lemma = lemmatizer as unknown as WinkLemmatizer;

type Pos = 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';

const BATCH_SIZE = 200;

function isMultiWord(text: string): boolean {
  // Treat anything with whitespace or hyphen as a phrase for lemmatization
  // purposes — wink only handles single tokens.
  return /\s/.test(text.trim());
}

function lemmatizeFor(text: string, pos: Pos): string {
  const lower = text.trim().toLowerCase();
  if (!lower) return lower;

  // Multi-word entries (phrases) are stored as-is.
  if (pos === 'phrase' || isMultiWord(lower)) {
    return lower;
  }

  switch (pos) {
    case 'noun':
      return lema(lemma.noun, lower);
    case 'verb':
      return lema(lemma.verb, lower);
    case 'adj':
      return lema(lemma.adjective, lower);
    case 'adv':
    default:
      return lower;
  }
}

function lema(fn: (w: string) => string, w: string): string {
  try {
    const res = fn(w);
    return typeof res === 'string' && res.length > 0 ? res : w;
  } catch {
    return w;
  }
}

type WordRow = {
  id: number;
  text: string;
};

type MeaningPosRow = {
  wordId: number;
  pos: Pos;
};

async function main() {
  console.log('[fill-lemmas] Starting…');

  // 1. Pull all words that still need processing.
  const targets = (await db
    .select({ id: words.id, text: words.text })
    .from(words)
    .where(sql`${words.lemma} IS NULL`)) as WordRow[];

  const total = targets.length;
  console.log(`[fill-lemmas] Words to process: ${total}`);

  if (total === 0) {
    const cov = await coverage();
    console.log(
      `[fill-lemmas] Nothing to do. Coverage: ${cov.filled}/${cov.total} (${cov.pct.toFixed(2)}%)`,
    );
    process.exit(0);
  }

  // 2. Fetch POS rows in chunks (avoid one giant IN-list).
  // We aggregate the most common POS per word_id.
  const posByWord = new Map<number, Pos>();
  const ids = targets.map((t) => t.id);
  const POS_CHUNK = 1000;
  for (let i = 0; i < ids.length; i += POS_CHUNK) {
    const slice = ids.slice(i, i + POS_CHUNK);
    const rows = (await db
      .select({
        wordId: wordMeanings.wordId,
        pos: wordMeanings.partOfSpeech,
      })
      .from(wordMeanings)
      .where(sql`${wordMeanings.wordId} IN ${slice}`)) as MeaningPosRow[];

    // Tally POS per word_id.
    const tally = new Map<number, Map<Pos, number>>();
    for (const r of rows) {
      let inner = tally.get(r.wordId);
      if (!inner) {
        inner = new Map();
        tally.set(r.wordId, inner);
      }
      inner.set(r.pos, (inner.get(r.pos) ?? 0) + 1);
    }
    for (const [wordId, counts] of tally) {
      let bestPos: Pos = 'noun';
      let bestN = -1;
      for (const [p, n] of counts) {
        if (n > bestN) {
          bestN = n;
          bestPos = p;
        }
      }
      posByWord.set(wordId, bestPos);
    }
  }

  // 3. Compute lemmas + write in batches.
  let processed = 0;
  let batchesDone = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    // Run updates for the batch in parallel — each is a tiny by-id update.
    await Promise.all(
      batch.map(async (row) => {
        const pos = posByWord.get(row.id) ?? 'noun';
        const value = lemmatizeFor(row.text, pos);
        await db
          .update(words)
          .set({ lemma: value, updatedAt: new Date() })
          .where(sql`${words.id} = ${row.id}`);
      }),
    );
    processed += batch.length;
    batchesDone += 1;
    if (batchesDone % 5 === 0 || processed === total) {
      console.log(
        `[fill-lemmas] Batch ${batchesDone} done — ${processed}/${total}`,
      );
    }
  }

  // 4. Final coverage summary.
  const cov = await coverage();
  console.log(
    `[fill-lemmas] Coverage: ${cov.filled}/${cov.total} (${cov.pct.toFixed(2)}%)`,
  );

  process.exit(0);
}

async function coverage(): Promise<{ total: number; filled: number; pct: number }> {
  const totalRow = await db.execute<{ c: string }>(sql`SELECT COUNT(*)::text AS c FROM words`);
  const filledRow = await db.execute<{ c: string }>(
    sql`SELECT COUNT(*)::text AS c FROM words WHERE lemma IS NOT NULL`,
  );
  const total = Number(totalRow.rows[0]?.c ?? 0);
  const filled = Number(filledRow.rows[0]?.c ?? 0);
  const pct = total > 0 ? (filled / total) * 100 : 0;
  return { total, filled, pct };
}

main().catch((err) => {
  console.error('[fill-lemmas] FAILED', err);
  process.exit(1);
});
