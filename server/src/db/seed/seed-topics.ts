import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, inArray } from 'drizzle-orm';
import { topics, wordMeaningTopics, words, wordMeanings } from '../schema.js';
import { topicDefs } from './topics.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

async function seedTopics() {
  const reset = process.argv.includes('--reset');

  if (reset) {
    console.log('Resetting all topic links...');
    await db.delete(wordMeaningTopics);
    await db.delete(topics);
    console.log('Done.\n');
  }

  console.log('Seeding topics...\n');

  let topicsCreated = 0;
  let wordsLinked = 0;
  let wordsInserted = 0;
  let wordsNotFound = 0;

  for (const def of topicDefs) {
    // Upsert topic
    let [topic] = await db
      .select()
      .from(topics)
      .where(eq(topics.slug, def.slug))
      .limit(1);

    if (!topic) {
      [topic] = await db
        .insert(topics)
        .values({
          slug: def.slug,
          title: def.title,
          description: def.description,
          iconName: def.iconName,
          sortOrder: def.sortOrder,
        })
        .returning();
      topicsCreated++;
      console.log(`✓ Created topic "${def.title}"`);
    } else {
      console.log(`— Topic "${def.title}" already exists`);
    }

    // Fetch all words from the list that exist in DB
    const existingWords = await db
      .select({ id: words.id, text: words.text })
      .from(words)
      .where(inArray(words.text, def.words));

    const existingTexts = new Set(existingWords.map((w) => w.text));

    // Insert missing words (without meanings — enrich will handle them)
    const missingWords = def.words.filter((w) => !existingTexts.has(w));
    const insertedWordIds: number[] = [];

    if (missingWords.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < missingWords.length; i += batchSize) {
        const batch = missingWords.slice(i, i + batchSize);
        const inserted = await db
          .insert(words)
          .values(batch.map((text) => ({ text, language: 'en' })))
          .onConflictDoNothing()
          .returning({ id: words.id });
        insertedWordIds.push(...inserted.map((w) => w.id));
      }
      wordsInserted += missingWords.length;
      console.log(`  + Inserted ${missingWords.length} new words: ${missingWords.join(', ')}`);
    }

    // Get all word IDs (existing + newly inserted)
    const allWordIds = [
      ...existingWords.map((w) => w.id),
      ...insertedWordIds,
    ];

    if (allWordIds.length === 0) {
      console.log(`  ! No words found or inserted for "${def.title}"`);
      continue;
    }

    // Get meanings for these words
    const meanings = await db
      .select({ id: wordMeanings.id })
      .from(wordMeanings)
      .where(inArray(wordMeanings.wordId, allWordIds));

    if (meanings.length === 0) {
      wordsNotFound += allWordIds.length;
      console.log(`  ! ${allWordIds.length} words have no meanings yet (run enrich first, then re-run seed-topics)`);
      continue;
    }

    // Get existing links for this topic to avoid duplicates
    const existingLinks = await db
      .select({ meaningId: wordMeaningTopics.meaningId })
      .from(wordMeaningTopics)
      .where(eq(wordMeaningTopics.topicId, topic!.id));

    const linkedMeaningIds = new Set(existingLinks.map((l) => l.meaningId));
    const newMeanings = meanings.filter((m) => !linkedMeaningIds.has(m.id));

    if (newMeanings.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < newMeanings.length; i += batchSize) {
        const batch = newMeanings.slice(i, i + batchSize);
        await db.insert(wordMeaningTopics).values(
          batch.map((m) => ({
            meaningId: m.id,
            topicId: topic!.id,
          })),
        );
      }
      wordsLinked += newMeanings.length;
      console.log(`  → Linked ${newMeanings.length} meanings to "${def.title}"`);
    } else {
      console.log(`  → All meanings already linked`);
    }
  }

  console.log(`\nDone!`);
  console.log(`  Topics created: ${topicsCreated}`);
  console.log(`  New words inserted: ${wordsInserted}`);
  console.log(`  Meanings linked: ${wordsLinked}`);
  if (wordsNotFound > 0) {
    console.log(`  Words without meanings: ${wordsNotFound} (run db:enrich, then re-run db:seed-topics)`);
  }

  await pool.end();
}

seedTopics().catch((err) => {
  console.error('Topic seeding failed:', err);
  process.exit(1);
});
