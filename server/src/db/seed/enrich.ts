import { eq, sql } from 'drizzle-orm';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import lemmatizer from 'wink-lemmatizer';
import { words, wordMeanings } from '../schema.js';
import { lookup } from '../../services/dictionary-service.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});

const db = drizzle(pool);

// Перевод должен содержать кириллицу (фильтр латинских терминов)
const CYRILLIC_RE = /[а-яёА-ЯЁ]/;

// Лемматизация: приводим слово к начальной форме (shoes → shoe)
function lemmatize(text: string): string[] {
  const word = text.trim().toLowerCase();

  // Если слово содержит пробел — это фраза, пробуем каждое слово отдельно
  if (word.includes(' ')) {
    const parts = word.split(' ');
    // Возвращаем последнее слово как основное (ground hog → hog)
    const lastWord = parts[parts.length - 1];
    return [word, lastWord, lemmatizer.noun(lastWord), lemmatizer.verb(lastWord)];
  }

  // Пробуем разные части речи
  const forms = new Set<string>([word]);
  forms.add(lemmatizer.noun(word));
  forms.add(lemmatizer.verb(word));
  forms.add(lemmatizer.adjective(word));

  return [...forms].filter(Boolean);
}

type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1';

function rankToCefr(rank: number | null): CefrLevel {
  if (rank === null) return 'b1';
  if (rank <= 500) return 'a1';
  if (rank <= 1200) return 'a2';
  if (rank <= 2000) return 'b1';
  return 'b2';
}

function rankToDifficulty(rank: number | null): 'easy' | 'medium' | 'hard' {
  if (rank === null) return 'medium';
  if (rank <= 500) return 'easy';
  if (rank <= 1500) return 'medium';
  return 'hard';
}

async function enrich() {
  // Флаг: обогащать только слова без meanings (по умолчанию) или все
  const onlyEmpty = !process.argv.includes('--all');

  let allWords;
  if (onlyEmpty) {
    // Слова без meanings — ещё не обогащённые
    allWords = await db
      .select()
      .from(words)
      .where(
        sql`${words.id} NOT IN (SELECT ${wordMeanings.wordId} FROM ${wordMeanings})`,
      );

    console.log(`Enriching ${allWords.length} words without meanings...\n`);
  } else {
    allWords = await db.select().from(words);
    console.log(`Enriching ALL ${allWords.length} words...\n`);
  }

  if (allWords.length === 0) {
    console.log('No words to enrich.');
    await pool.end();
    return;
  }

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i];
    const progress = `[${i + 1}/${allWords.length}]`;

    try {
      console.log(`${progress} [${word.text}] Looking up...`);

      // Пробуем оригинальное слово и лемматизированные формы
      const forms = lemmatize(word.text);
      let result = await lookup(forms[0], { skipCache: true });
      let usedLemma: string | null = null; // Лемма, через которую нашли результат

      // Если не нашли — пробуем другие формы (лемматизированные)
      if (result.meanings.length === 0 && forms.length > 1) {
        for (let j = 1; j < forms.length; j++) {
          const form = forms[j];
          if (form === forms[0]) continue; // пропускаем дубликаты

          console.log(`  → Trying lemma: ${form}`);
          result = await lookup(form, { skipCache: true });

          if (result.meanings.length > 0) {
            console.log(`  → Found via lemma: ${form}`);
            usedLemma = form; // Запоминаем лемму
            break;
          }

          // Rate limiting между попытками
          await new Promise((r) => setTimeout(r, 200));
        }
      }

      if (result.meanings.length === 0) {
        console.log(`  → No results from dictionary, skipping`);
        skipped++;
        continue;
      }

      // Обновляем транскрипцию и лемму слова
      const wordUpdates: Record<string, unknown> = {};
      if (result.transcription && !word.transcription) {
        wordUpdates.transcription = result.transcription;
      }
      // Сохраняем лемму только если она отличается от оригинального слова
      if (usedLemma && usedLemma !== word.text.toLowerCase() && !word.lemma) {
        wordUpdates.lemma = usedLemma;
        console.log(`  → Saving lemma: ${usedLemma}`);
      }
      if (Object.keys(wordUpdates).length > 0) {
        await db.update(words).set(wordUpdates).where(eq(words.id, word.id));
      }

      const existingMeanings = await db
        .select()
        .from(wordMeanings)
        .where(eq(wordMeanings.wordId, word.id));

      const cefr = rankToCefr(word.frequencyRank);
      const difficulty = rankToDifficulty(word.frequencyRank);
      let added = 0;
      let updated = 0;

      // Фильтруем переводы без кириллицы (латинские термины типа "Plus", "Wi-Fi")
      const validMeanings = result.meanings.filter(m => CYRILLIC_RE.test(m.translation));

      for (let idx = 0; idx < validMeanings.length; idx++) {
        const m = validMeanings[idx]!;
        const popularityRank = idx + 1; // 1 = самый популярный

        const existing = existingMeanings.find(
          (e) => e.translation === m.translation,
        );

        if (existing) {
          // Обновляем все поля если их не было
          const updates: Record<string, unknown> = {};
          if (!existing.contextExample && m.examples.length > 0) {
            updates.contextExample = m.examples[0]!.text;
          }
          if (!existing.cefr) {
            updates.cefr = cefr;
          }
          if (existing.popularityRank === null) {
            updates.popularityRank = popularityRank;
          }
          if (existing.frequency === null && m.frequency !== null) {
            updates.frequency = m.frequency;
          }
          if (!existing.meaningHints && m.meaningHints.length > 0) {
            updates.meaningHints = m.meaningHints;
          }
          if (!existing.synonyms && m.synonyms.length > 0) {
            updates.synonyms = m.synonyms;
          }
          if (!existing.translationPartOfSpeech && m.translationPartOfSpeech) {
            updates.translationPartOfSpeech = m.translationPartOfSpeech;
          }
          if (!existing.examples && m.examples.length > 0) {
            updates.examples = m.examples;
          }
          if (Object.keys(updates).length > 0) {
            await db
              .update(wordMeanings)
              .set(updates)
              .where(eq(wordMeanings.id, existing.id));
            updated++;
          }
        } else {
          await db.insert(wordMeanings).values({
            wordId: word.id,
            translation: m.translation,
            partOfSpeech: m.partOfSpeech as 'noun' | 'verb' | 'adj' | 'adv' | 'phrase',
            translationPartOfSpeech: m.translationPartOfSpeech,
            contextExample: m.examples[0]?.text ?? null,
            difficulty,
            cefr,
            popularityRank,
            frequency: m.frequency,
            meaningHints: m.meaningHints.length > 0 ? m.meaningHints : null,
            synonyms: m.synonyms.length > 0 ? m.synonyms : null,
            examples: m.examples.length > 0 ? m.examples : null,
          });
          added++;
        }
      }

      console.log(`  → ${added} new meanings, ${updated} updated`);
      enriched++;

      // Rate limiting
      await new Promise((r) => setTimeout(r, 300));
    } catch (err) {
      console.error(`  → ERROR: ${err instanceof Error ? err.message : err}`);
      failed++;
      // Продолжаем после ошибки
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log(`\nDone! Enriched: ${enriched}, Skipped: ${skipped}, Failed: ${failed}`);
  await pool.end();
}

enrich().catch((err) => {
  console.error('Enrich failed:', err);
  process.exit(1);
});
