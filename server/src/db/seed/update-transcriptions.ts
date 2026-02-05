/**
 * Скрипт для обновления транскрипций у слов, где их нет
 * Запуск: npx tsx src/db/seed/update-transcriptions.ts
 */

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { isNull } from 'drizzle-orm';
import * as schema from '../schema.js';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
const { words } = schema;

const YANDEX_API_URL = 'https://dictionary.yandex.net/api/v1/dicservice.json/lookup';

type YandexDictionaryResponse = {
  def: { ts?: string }[];
};

async function updateTranscriptions() {
  const apiKey = process.env.YANDEX_DICTIONARY_API_KEY;
  if (!apiKey) {
    console.error('YANDEX_DICTIONARY_API_KEY не задан');
    process.exit(1);
  }

  // Слова без транскрипции
  const wordsWithoutTranscription = await db
    .select({ id: words.id, text: words.text })
    .from(words)
    .where(isNull(words.transcription));

  console.log(`Found ${wordsWithoutTranscription.length} words without transcription`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < wordsWithoutTranscription.length; i++) {
    const word = wordsWithoutTranscription[i]!;
    const progress = `[${i + 1}/${wordsWithoutTranscription.length}]`;

    try {
      const url = `${YANDEX_API_URL}?key=${encodeURIComponent(apiKey)}&lang=en-ru&text=${encodeURIComponent(word.text)}`;
      const response = await fetch(url);

      if (!response.ok) {
        console.log(`${progress} [${word.text}] API error: ${response.status}`);
        failed++;
        continue;
      }

      const data = (await response.json()) as YandexDictionaryResponse;
      const transcription = data.def[0]?.ts;

      if (!transcription) {
        console.log(`${progress} [${word.text}] No transcription in API`);
        skipped++;
        continue;
      }

      await db.update(words).set({ transcription }).where(schema.eq(words.id, word.id));
      console.log(`${progress} [${word.text}] → ${transcription}`);
      updated++;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      console.error(`${progress} [${word.text}] Error:`, err);
      failed++;
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  await pool.end();
}

updateTranscriptions().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
