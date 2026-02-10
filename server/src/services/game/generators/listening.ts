import { ne, and, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { wordMeanings } from '../../../db/schema.js';
import type { PooledMeaning, ListeningQuestion } from '../types.js';
import {
  shuffle,
  getAllTranslations,
  getPopularityFilter,
  getFrequencyFilter,
  CYRILLIC_FILTER,
} from './multiple-choice.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Количество вариантов ответа (включая правильный) */
const TOTAL_OPTIONS = 4;

/** Количество дистракторов */
const DISTRACTORS_COUNT = TOTAL_OPTIONS - 1;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Собирает уникальные переводы из результатов запроса */
function collectUniqueTranslations(
  rows: { translation: string }[],
  usedTexts: Set<string>,
  result: string[],
  target: number,
) {
  for (const row of rows) {
    if (result.length >= target) break;
    if (!usedTexts.has(row.translation)) {
      usedTexts.add(row.translation);
      result.push(row.translation);
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Генерирует listening вопрос: пользователь слышит английское слово через TTS,
 * выбирает правильный русский перевод из 4 вариантов.
 *
 * Направление всегда en→ru.
 */
export async function generateListeningFromMeaning(
  correct: PooledMeaning,
): Promise<ListeningQuestion | null> {
  const popularityFilter = getPopularityFilter();
  const frequencyFilter = getFrequencyFilter();

  const correctTranslations = getAllTranslations(correct);
  const correctTranslationsSet = new Set(correctTranslations);

  // Собираем уникальные дистракторы-переводы
  const usedTexts = new Set(correctTranslationsSet);
  const distractors: string[] = [];

  // Шаг 1: та же часть речи и сложность
  const step1 = await db.query.wordMeanings.findMany({
    where: and(
      popularityFilter, frequencyFilter, CYRILLIC_FILTER,
      ne(wordMeanings.id, correct.id),
      sql`${wordMeanings.difficulty} = ${correct.difficulty}`,
      sql`${wordMeanings.partOfSpeech} = ${correct.partOfSpeech}`,
      sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
    ),
    columns: { translation: true },
    limit: 10,
    orderBy: sql`RANDOM()`,
  });
  collectUniqueTranslations(step1, usedTexts, distractors, DISTRACTORS_COUNT);

  // Шаг 2: та же сложность, любая часть речи
  if (distractors.length < DISTRACTORS_COUNT) {
    const step2 = await db.query.wordMeanings.findMany({
      where: and(
        popularityFilter, frequencyFilter, CYRILLIC_FILTER,
        ne(wordMeanings.id, correct.id),
        sql`${wordMeanings.difficulty} = ${correct.difficulty}`,
        sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
      ),
      columns: { translation: true },
      limit: 10,
      orderBy: sql`RANDOM()`,
    });
    collectUniqueTranslations(step2, usedTexts, distractors, DISTRACTORS_COUNT);
  }

  // Шаг 3: любая сложность
  if (distractors.length < DISTRACTORS_COUNT) {
    const step3 = await db.query.wordMeanings.findMany({
      where: and(
        popularityFilter, frequencyFilter, CYRILLIC_FILTER,
        ne(wordMeanings.id, correct.id),
        sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
      ),
      columns: { translation: true },
      limit: 10,
      orderBy: sql`RANDOM()`,
    });
    collectUniqueTranslations(step3, usedTexts, distractors, DISTRACTORS_COUNT);
  }

  // Если не хватает дистракторов — не генерируем
  if (distractors.length < DISTRACTORS_COUNT) return null;

  const options = shuffle([correct.translation, ...distractors]);

  return {
    type: 'listening',
    meaningId: correct.id,
    audioWord: correct.word.lemma ?? correct.word.text,
    transcription: correct.word.transcription,
    options,
    correctAnswer: correct.translation,
  };
}
