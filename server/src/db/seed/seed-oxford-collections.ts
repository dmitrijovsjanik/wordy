import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { and, eq, inArray } from 'drizzle-orm';
import { collections, collectionWords, words, wordMeanings } from '../schema.js';
import { lookup } from '../../services/dictionary-service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});
const db = drizzle(pool);

type OxfordList = {
  title: string;
  description: string;
  iconName: string;
  dataFile: string;
};

const LISTS: OxfordList[] = [
  {
    title: 'Oxford 3000',
    description:
      'Базовый словарь A1–B2 от Oxford: 3000 самых важных слов для уверенного владения языком',
    iconName: 'BookOpen02Icon',
    dataFile: 'data/oxford-3000.json',
  },
  {
    title: 'Oxford 5000',
    description:
      'Расширенный словарь A1–C1 от Oxford: 5000 слов, включает все слова Oxford 3000 плюс лексику B2–C1',
    iconName: 'UniversityIcon',
    dataFile: 'data/oxford-5000.json',
  },
];

const CATEGORY = 'oxford';

type LookupOutcome = 'found' | 'imported' | 'no_translations' | 'error';

async function findWordWithMeaning(text: string): Promise<{ id: number } | null> {
  const rows = await db
    .select({ id: words.id, meaningId: wordMeanings.id })
    .from(words)
    .leftJoin(wordMeanings, eq(wordMeanings.wordId, words.id))
    .where(eq(words.text, text))
    .limit(1);
  if (rows.length === 0) return null;
  if (rows[0].meaningId === null) return null;
  return { id: rows[0].id };
}

async function ensureWordInDb(text: string): Promise<{ wordId: number | null; outcome: LookupOutcome }> {
  const normalized = text.trim().toLowerCase();

  const existing = await findWordWithMeaning(normalized);
  if (existing) {
    return { wordId: existing.id, outcome: 'found' };
  }

  try {
    const result = await lookup(normalized);
    if (result.meanings.length === 0) {
      return { wordId: null, outcome: 'no_translations' };
    }
    const inserted = await db
      .select({ id: words.id })
      .from(words)
      .where(eq(words.text, normalized))
      .limit(1);
    return inserted.length > 0
      ? { wordId: inserted[0].id, outcome: 'imported' }
      : { wordId: null, outcome: 'error' };
  } catch (err) {
    console.error(`  ! lookup failed for "${normalized}":`, err instanceof Error ? err.message : err);
    return { wordId: null, outcome: 'error' };
  }
}

async function upsertCollection(list: OxfordList): Promise<number> {
  const existing = await db
    .select()
    .from(collections)
    .where(and(eq(collections.title, list.title), eq(collections.type, 'system')))
    .limit(1);

  if (existing.length > 0) {
    console.log(`  Collection "${list.title}" already exists (id=${existing[0].id}) — reusing`);
    return existing[0].id;
  }

  const [inserted] = await db
    .insert(collections)
    .values({
      type: 'system',
      title: list.title,
      description: list.description,
      iconName: list.iconName,
      category: CATEGORY,
      isPublished: true,
      totalWords: 0,
    })
    .returning({ id: collections.id });

  console.log(`  Collection "${list.title}" created (id=${inserted.id})`);
  return inserted.id;
}

async function syncCollectionWords(
  collectionId: number,
  meaningIds: number[],
): Promise<{ inserted: number; alreadyPresent: number }> {
  if (meaningIds.length === 0) return { inserted: 0, alreadyPresent: 0 };

  const existingRows = await db
    .select({ meaningId: collectionWords.meaningId })
    .from(collectionWords)
    .where(eq(collectionWords.collectionId, collectionId));
  const existingSet = new Set(existingRows.map((r) => r.meaningId));

  const toInsert = meaningIds.filter((id) => !existingSet.has(id));
  if (toInsert.length === 0) {
    return { inserted: 0, alreadyPresent: meaningIds.length };
  }

  const batchSize = 500;
  let baseOrder = existingSet.size;
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    await db.insert(collectionWords).values(
      batch.map((meaningId, idx) => ({
        collectionId,
        meaningId,
        order: baseOrder + i + idx,
      })),
    );
  }

  return { inserted: toInsert.length, alreadyPresent: meaningIds.length - toInsert.length };
}

async function processList(list: OxfordList, skipImport: boolean) {
  const filePath = resolve(__dirname, list.dataFile);
  const wordsFromFile: string[] = JSON.parse(readFileSync(filePath, 'utf8'));
  console.log(`\n=== ${list.title} ===`);
  console.log(`  Loaded ${wordsFromFile.length} words from ${list.dataFile}`);

  const collectionId = await upsertCollection(list);

  const stats = { found: 0, imported: 0, no_translations: 0, error: 0 };
  const wordIds: number[] = [];
  const failures: { word: string; outcome: LookupOutcome }[] = [];

  for (let i = 0; i < wordsFromFile.length; i++) {
    const text = wordsFromFile[i];
    let outcome: LookupOutcome;
    let wordId: number | null;

    if (skipImport) {
      const existing = await findWordWithMeaning(text.toLowerCase());
      if (existing) {
        wordId = existing.id;
        outcome = 'found';
      } else {
        wordId = null;
        outcome = 'no_translations';
      }
    } else {
      const result = await ensureWordInDb(text);
      wordId = result.wordId;
      outcome = result.outcome;
    }

    stats[outcome]++;
    if (wordId !== null) wordIds.push(wordId);
    else failures.push({ word: text, outcome });

    if ((i + 1) % 100 === 0) {
      console.log(
        `  Progress: ${i + 1}/${wordsFromFile.length} — found=${stats.found}, imported=${stats.imported}, missing=${stats.no_translations}, errors=${stats.error}`,
      );
    }
  }

  console.log(`  Words resolved: ${wordIds.length}/${wordsFromFile.length}`);
  console.log(
    `    found=${stats.found}, imported=${stats.imported}, no_translations=${stats.no_translations}, errors=${stats.error}`,
  );

  if (wordIds.length === 0) {
    console.log('  Skipping collection words insert — no resolved words');
    return;
  }

  // Получаем ВСЕ meanings для найденных слов. Фильтр rank<=3 применяется на чтении
  // в collection-service, поэтому здесь сохраняем все meanings.
  const meaningRows = await db
    .select({ id: wordMeanings.id, wordId: wordMeanings.wordId })
    .from(wordMeanings)
    .where(inArray(wordMeanings.wordId, wordIds));

  const meaningIds = meaningRows.map((m) => m.id);
  console.log(`  Found ${meaningIds.length} meanings for ${wordIds.length} words`);

  const { inserted, alreadyPresent } = await syncCollectionWords(collectionId, meaningIds);
  console.log(`  Inserted ${inserted} new collection_words rows (${alreadyPresent} were already present)`);

  await db
    .update(collections)
    .set({ totalWords: wordIds.length, updatedAt: new Date() })
    .where(eq(collections.id, collectionId));
  console.log(`  Updated collection.totalWords = ${wordIds.length}`);

  if (failures.length > 0) {
    const sample = failures.slice(0, 20).map((f) => `${f.word} (${f.outcome})`);
    console.log(`  Failures (showing ${Math.min(20, failures.length)}/${failures.length}):`, sample);
  }
}

async function main() {
  const skipImport = process.argv.includes('--no-import');
  if (skipImport) {
    console.log('Running in --no-import mode: missing words will be skipped, not fetched from Yandex\n');
  }

  for (const list of LISTS) {
    await processList(list, skipImport);
  }

  console.log('\nDone.');
  await pool.end();
}

main().catch(async (err) => {
  console.error('Seed failed:', err);
  await pool.end();
  process.exit(1);
});
