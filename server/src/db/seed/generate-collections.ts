import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, isNotNull } from 'drizzle-orm';
import { collections, collectionWords, words, wordMeanings, topics, wordMeaningTopics } from '../schema.js';

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
    title: 'Начальный уровень',
    description: 'Самые частотные 500 слов — базовая лексика для повседневного общения',
    iconName: 'BookOpen02Icon',
  },
  {
    cefr: 'a2',
    title: 'Элементарный',
    description: 'Расширение словарного запаса для простых разговоров и текстов',
    iconName: 'Book02Icon',
  },
  {
    cefr: 'b1',
    title: 'Средний уровень',
    description: 'Лексика для свободного чтения и обсуждения повседневных тем',
    iconName: 'MortarboardIcon',
  },
  {
    cefr: 'b2',
    title: 'Продвинутый',
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
  uniqueWordCount: number,
  category?: string,
  cefrLevel?: CefrLevel,
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
      cefrLevel,
      category,
      isPublished: true,
      totalWords: uniqueWordCount,
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
    const filtered = allMeanings.filter((m) => m.cefr === config.cefr);
    const meaningIds = filtered.map((m) => m.meaningId);
    const uniqueWords = new Set(filtered.map((m) => m.wordId)).size;

    await createCollection(config.title, config.description, config.iconName, meaningIds, uniqueWords, 'level', config.cefr);
  }

  // 2. Коллекции по POS + уровню
  console.log('\n--- POS + Level collections ---');
  for (const config of LEVEL_CONFIGS) {
    const levelMeanings = allMeanings.filter((m) => m.cefr === config.cefr);

    for (const [pos, posName] of Object.entries(POS_NAMES)) {
      const filtered = levelMeanings.filter((m) => m.partOfSpeech === pos);
      const meaningIds = filtered.map((m) => m.meaningId);

      if (meaningIds.length < MIN_WORDS_FOR_POS_COLLECTION) {
        console.log(`  "${posName} ${CEFR_LABELS[config.cefr]}" — only ${meaningIds.length} words, skipping`);
        continue;
      }

      const uniqueWords = new Set(filtered.map((m) => m.wordId)).size;
      const title = posName;
      const description = `${posName} уровня ${CEFR_LABELS[config.cefr]} из списка NGSL`;
      const iconName = POS_ICONS[pos] ?? 'BookOpen02Icon';

      await createCollection(title, description, iconName, meaningIds, uniqueWords, 'pos', config.cefr);
    }
  }

  // 3. Коллекции по темам
  console.log('\n--- Topic collections ---');
  const allTopics = await db.select().from(topics).orderBy(topics.sortOrder);

  for (const topic of allTopics) {
    const topicMeanings = await db
      .select({
        meaningId: wordMeaningTopics.meaningId,
        wordId: wordMeanings.wordId,
      })
      .from(wordMeaningTopics)
      .innerJoin(wordMeanings, eq(wordMeaningTopics.meaningId, wordMeanings.id))
      .where(eq(wordMeaningTopics.topicId, topic.id));

    if (topicMeanings.length < 10) {
      console.log(`  "${topic.title}" — only ${topicMeanings.length} meanings, skipping`);
      continue;
    }

    const meaningIds = topicMeanings.map((m) => m.meaningId);
    const uniqueWords = new Set(topicMeanings.map((m) => m.wordId)).size;

    await createCollection(
      topic.title,
      topic.description ?? `Слова по теме «${topic.title}»`,
      topic.iconName ?? 'BookOpen02Icon',
      meaningIds,
      uniqueWords,
      'topic',
    );
  }

  console.log('\nCollection generation complete!');
  await pool.end();
}

generateCollections().catch((err) => {
  console.error('Collection generation failed:', err);
  process.exit(1);
});
