import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { words, wordMeanings } from '../schema.js';
import { seedWords } from './words.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

async function seed() {
  console.log('Seeding database...');

  for (const entry of seedWords) {
    const [existing] = await db
      .select()
      .from(words)
      .where(eq(words.text, entry.text))
      .limit(1);

    let wordId: number;

    if (existing) {
      wordId = existing.id;
      console.log(`  Word "${entry.text}" already exists, skipping insert`);
    } else {
      const [inserted] = await db
        .insert(words)
        .values({ text: entry.text })
        .returning({ id: words.id });
      wordId = inserted.id;
      console.log(`  Inserted word "${entry.text}"`);
    }

    for (const meaning of entry.meanings) {
      const [existingMeaning] = await db
        .select()
        .from(wordMeanings)
        .where(eq(wordMeanings.wordId, wordId))
        .limit(1);

      if (!existingMeaning) {
        await db.insert(wordMeanings).values({
          wordId,
          translation: meaning.translation,
          partOfSpeech: meaning.partOfSpeech,
          contextExample: meaning.contextExample,
          difficulty: meaning.difficulty,
        });
      }
    }
  }

  console.log('Seed complete!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
