import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { wordMeanings } from '../schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

/**
 * Удаляет переводы, которые не содержат кириллицы.
 * Такие записи — ошибки данных (латинские термины вместо русских переводов).
 */
async function cleanupLatinTranslations() {
  const dryRun = !process.argv.includes('--execute');

  console.log('Searching for translations without Cyrillic characters...\n');

  // Находим все переводы без кириллицы
  const latinTranslations = await db
    .select({
      id: wordMeanings.id,
      wordId: wordMeanings.wordId,
      translation: wordMeanings.translation,
    })
    .from(wordMeanings)
    .where(sql`${wordMeanings.translation} !~ '[а-яА-ЯёЁ]'`);

  if (latinTranslations.length === 0) {
    console.log('No invalid translations found. Database is clean!');
    await pool.end();
    return;
  }

  console.log(`Found ${latinTranslations.length} translations without Cyrillic:\n`);

  for (const t of latinTranslations) {
    console.log(`  id=${t.id} wordId=${t.wordId} translation="${t.translation}"`);
  }

  if (dryRun) {
    console.log('\n--- DRY RUN MODE ---');
    console.log('To actually delete these records, run with --execute flag:');
    console.log('  npx tsx src/db/seed/cleanup-latin-translations.ts --execute');
  } else {
    console.log('\nDeleting invalid translations...');

    const ids = latinTranslations.map(t => t.id);
    await db
      .delete(wordMeanings)
      .where(sql`${wordMeanings.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);

    console.log(`Deleted ${latinTranslations.length} invalid translations.`);
  }

  await pool.end();
}

cleanupLatinTranslations().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
