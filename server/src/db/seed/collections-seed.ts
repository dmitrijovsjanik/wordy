import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and, inArray } from 'drizzle-orm';
import { collections, collectionWords, words, wordMeanings } from '../schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

type CollectionDef = {
  title: string;
  description: string;
  iconName: string;
  wordTexts: string[];
};

const systemCollections: CollectionDef[] = [
  {
    title: 'Базовые слова',
    description: 'Самые простые и часто используемые слова для начинающих',
    iconName: 'BookOpen02Icon',
    wordTexts: [
      'cat', 'dog', 'apple', 'water', 'house', 'sun', 'table', 'time',
      'happy', 'big', 'friend', 'food', 'family', 'school', 'beautiful', 'fast',
    ],
  },
  {
    title: 'Слова с несколькими значениями',
    description: 'Многозначные слова — одно написание, разные переводы',
    iconName: 'Shuffle01Icon',
    wordTexts: [
      'train', 'book', 'light', 'run', 'play', 'watch', 'match', 'right',
      'bat', 'bark', 'fire', 'spring', 'letter', 'kind', 'figure', 'draw',
      'fair', 'degree', 'point', 'subject', 'novel', 'sentence', 'trip', 'mean',
    ],
  },
  {
    title: 'Продвинутая лексика',
    description: 'Слова среднего и продвинутого уровня для уверенных пользователей',
    iconName: 'MortarboardIcon',
    wordTexts: [
      'challenge', 'develop', 'environment', 'experience', 'achieve', 'manage',
      'support', 'research', 'improve', 'increase', 'provide', 'require',
      'consider', 'avoid', 'opportunity', 'behavior', 'suggest', 'particular',
      'current', 'involve', 'remain',
    ],
  },
  {
    title: 'Академический английский',
    description: 'Сложные слова для продвинутого уровня',
    iconName: 'UniversityIcon',
    wordTexts: [
      'approximately', 'ambiguous', 'elaborate', 'negligible', 'comprehensive',
      'acquire', 'inevitable', 'sufficient', 'consequently', 'distinguish',
      'reluctant', 'simultaneously', 'persevere', 'obsolete', 'versatile',
      'thoroughly', 'undermine',
    ],
  },
];

async function seedCollections() {
  console.log('Seeding collections...');

  for (const def of systemCollections) {
    const [existing] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.title, def.title), eq(collections.type, 'system')))
      .limit(1);

    if (existing) {
      console.log(`  Collection "${def.title}" already exists, skipping`);
      continue;
    }

    // Get meaning IDs for the words
    const wordRows = await db
      .select({ id: words.id, text: words.text })
      .from(words)
      .where(inArray(words.text, def.wordTexts));

    if (wordRows.length === 0) {
      console.log(`  No words found for "${def.title}", skipping (run word seed first)`);
      continue;
    }

    const wordIds = wordRows.map((w) => w.id);
    const meanings = await db
      .select({ id: wordMeanings.id })
      .from(wordMeanings)
      .where(inArray(wordMeanings.wordId, wordIds));

    const [inserted] = await db
      .insert(collections)
      .values({
        type: 'system',
        title: def.title,
        description: def.description,
        iconName: def.iconName,
        isPublished: true,
        totalWords: meanings.length,
      })
      .returning({ id: collections.id });

    for (let i = 0; i < meanings.length; i++) {
      await db.insert(collectionWords).values({
        collectionId: inserted.id,
        meaningId: meanings[i].id,
        order: i,
      });
    }

    console.log(`  Created collection "${def.title}" with ${meanings.length} words`);
  }

  console.log('Collections seed complete!');
  await pool.end();
}

seedCollections().catch((err) => {
  console.error('Collections seed failed:', err);
  process.exit(1);
});
