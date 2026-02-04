import { eq, isNull } from 'drizzle-orm';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { words, wordMeanings } from '../schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

const YANDEX_API_URL = 'https://dictionary.yandex.net/api/v1/dicservice.json/lookup';

type YandexTranslation = {
  text: string;
  pos?: string;
};

type YandexDefinition = {
  text: string;
  pos?: string;
  tr: YandexTranslation[];
};

type YandexDictionaryResponse = {
  def: YandexDefinition[];
};

async function fetchYandexRanks(wordText: string): Promise<Map<string, number>> {
  const apiKey = process.env.YANDEX_DICTIONARY_API_KEY;
  if (!apiKey) {
    throw new Error('YANDEX_DICTIONARY_API_KEY не задан');
  }

  const url = `${YANDEX_API_URL}?key=${encodeURIComponent(apiKey)}&lang=en-ru&text=${encodeURIComponent(wordText)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Yandex API error: ${response.status}`);
  }

  const data = (await response.json()) as YandexDictionaryResponse;
  const ranks = new Map<string, number>();

  for (const def of data.def) {
    for (let i = 0; i < def.tr.length; i++) {
      const translation = def.tr[i]!.text.toLowerCase();
      // Если перевод уже есть с меньшим рангом — не перезаписываем
      if (!ranks.has(translation)) {
        ranks.set(translation, i + 1);
      }
    }
  }

  return ranks;
}

async function updatePopularityRanks() {
  // Получаем все слова у которых есть meanings без popularityRank
  const wordsWithoutRanks = await db
    .select({
      id: words.id,
      text: words.text,
    })
    .from(words)
    .innerJoin(wordMeanings, eq(wordMeanings.wordId, words.id))
    .where(isNull(wordMeanings.popularityRank))
    .groupBy(words.id, words.text);

  console.log(`Found ${wordsWithoutRanks.length} words with meanings without popularity ranks\n`);

  if (wordsWithoutRanks.length === 0) {
    console.log('Nothing to update.');
    await pool.end();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < wordsWithoutRanks.length; i++) {
    const word = wordsWithoutRanks[i]!;
    const progress = `[${i + 1}/${wordsWithoutRanks.length}]`;

    try {
      console.log(`${progress} [${word.text}] Fetching ranks...`);

      const ranks = await fetchYandexRanks(word.text);

      if (ranks.size === 0) {
        console.log(`  → No results from Yandex, skipping`);
        skipped++;
        continue;
      }

      // Получаем все meanings этого слова без ранга
      const meanings = await db
        .select()
        .from(wordMeanings)
        .where(eq(wordMeanings.wordId, word.id));

      let wordUpdated = 0;
      for (const meaning of meanings) {
        if (meaning.popularityRank !== null) continue;

        const translationLower = meaning.translation.toLowerCase();
        const rank = ranks.get(translationLower);

        if (rank) {
          await db
            .update(wordMeanings)
            .set({ popularityRank: rank })
            .where(eq(wordMeanings.id, meaning.id));
          wordUpdated++;
        } else {
          // Перевод не найден в Yandex — ставим высокий ранг (непопулярный)
          await db
            .update(wordMeanings)
            .set({ popularityRank: 999 })
            .where(eq(wordMeanings.id, meaning.id));
          wordUpdated++;
        }
      }

      console.log(`  → Updated ${wordUpdated} meanings`);
      updated++;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`  → ERROR: ${err instanceof Error ? err.message : err}`);
      failed++;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone! Updated: ${updated}, Skipped: ${skipped}, Failed: ${failed}`);
  await pool.end();
}

updatePopularityRanks().catch((err) => {
  console.error('Update failed:', err);
  process.exit(1);
});
