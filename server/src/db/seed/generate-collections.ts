import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, sql, isNotNull } from 'drizzle-orm';
import { collections, collectionWords, words, wordMeanings } from '../schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

const MIN_WORDS_FOR_POS_COLLECTION = 10;

type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2';

type LevelConfig = {
  cefr: CefrLevel;
  title: string;
  description: string;
  iconName: string;
};

const LEVEL_CONFIGS: LevelConfig[] = [
  {
    cefr: 'a1',
    title: 'Начальный уровень (A1)',
    description: 'Самые частотные 500 слов — базовая лексика для повседневного общения',
    iconName: 'BookOpen02Icon',
  },
  {
    cefr: 'a2',
    title: 'Элементарный (A2)',
    description: 'Расширение словарного запаса для простых разговоров и текстов',
    iconName: 'Book02Icon',
  },
  {
    cefr: 'b1',
    title: 'Средний уровень (B1)',
    description: 'Лексика для свободного чтения и обсуждения повседневных тем',
    iconName: 'MortarboardIcon',
  },
  {
    cefr: 'b2',
    title: 'Продвинутый (B2)',
    description: 'Углублённая лексика для уверенного владения языком',
    iconName: 'UniversityIcon',
  },
];

const POS_NAMES: Record<string, string> = {
  noun: 'Существительные',
  verb: 'Глаголы',
  adj: 'Прилагательные',
  adv: 'Наречия',
};

const POS_ICONS: Record<string, string> = {
  noun: 'TextIcon',
  verb: 'RunningIcon',
  adj: 'SparklesIcon',
  adv: 'ArrowRight01Icon',
};

const CEFR_LABELS: Record<CefrLevel, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
};

async function createCollection(
  title: string,
  description: string,
  iconName: string,
  meaningIds: number[],
) {
  if (meaningIds.length === 0) return;

  // Проверяем существование
  const [existing] = await db
    .select()
    .from(collections)
    .where(and(eq(collections.title, title), eq(collections.type, 'system')))
    .limit(1);

  if (existing) {
    console.log(`  "${title}" already exists (${existing.totalWords} words), skipping`);
    return;
  }

  const [inserted] = await db
    .insert(collections)
    .values({
      type: 'system',
      title,
      description,
      iconName,
      isPublished: true,
      totalWords: meaningIds.length,
    })
    .returning({ id: collections.id });

  // Batch insert collection_words
  const batchSize = 100;
  for (let i = 0; i < meaningIds.length; i += batchSize) {
    const batch = meaningIds.slice(i, i + batchSize);
    await db.insert(collectionWords).values(
      batch.map((meaningId, idx) => ({
        collectionId: inserted.id,
        meaningId,
        order: i + idx,
      })),
    );
  }

  console.log(`  Created "${title}" with ${meaningIds.length} words`);
}

async function generateCollections() {
  console.log('Generating collections from NGSL data...\n');

  // Получаем все meanings с CEFR и данными слова
  const allMeanings = await db
    .select({
      meaningId: wordMeanings.id,
      wordId: wordMeanings.wordId,
      partOfSpeech: wordMeanings.partOfSpeech,
      cefr: wordMeanings.cefr,
      frequencyRank: words.frequencyRank,
    })
    .from(wordMeanings)
    .innerJoin(words, eq(wordMeanings.wordId, words.id))
    .where(isNotNull(wordMeanings.cefr))
    .orderBy(words.frequencyRank);

  console.log(`Found ${allMeanings.length} meanings with CEFR levels\n`);

  if (allMeanings.length === 0) {
    console.log('No enriched words found. Run db:enrich first.');
    await pool.end();
    return;
  }

  // 1. Коллекции по уровням
  console.log('--- Level collections ---');
  for (const config of LEVEL_CONFIGS) {
    const meaningIds = allMeanings
      .filter((m) => m.cefr === config.cefr)
      .map((m) => m.meaningId);

    await createCollection(config.title, config.description, config.iconName, meaningIds);
  }

  // 2. Коллекции по POS + уровню
  console.log('\n--- POS + Level collections ---');
  for (const config of LEVEL_CONFIGS) {
    const levelMeanings = allMeanings.filter((m) => m.cefr === config.cefr);

    for (const [pos, posName] of Object.entries(POS_NAMES)) {
      const meaningIds = levelMeanings
        .filter((m) => m.partOfSpeech === pos)
        .map((m) => m.meaningId);

      if (meaningIds.length < MIN_WORDS_FOR_POS_COLLECTION) {
        console.log(`  "${posName} ${CEFR_LABELS[config.cefr]}" — only ${meaningIds.length} words, skipping`);
        continue;
      }

      const title = `${posName} ${CEFR_LABELS[config.cefr]}`;
      const description = `${posName} уровня ${CEFR_LABELS[config.cefr]} из списка NGSL`;
      const iconName = POS_ICONS[pos] ?? 'BookOpen02Icon';

      await createCollection(title, description, iconName, meaningIds);
    }
  }

  console.log('\nCollection generation complete!');
  await pool.end();
}

generateCollections().catch((err) => {
  console.error('Collection generation failed:', err);
  process.exit(1);
});
