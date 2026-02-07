import { eq, ne, and, or, sql, isNull, lte, gte } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { wordMeanings } from '../../../db/schema.js';
import type { LegacyQuestion, PooledMeaning, CustomWordForQuiz, LanguagePair } from '../types.js';
import { DEFAULT_LANG_PAIR, reversePair } from '../types.js';

// ─── Constants ──────────────────────────────────────────────────────────────

// Максимальный ранг популярности для использования в квизах
// (1 = самый популярный перевод, берём только топ-3)
export const MAX_POPULARITY_RANK = 3;

// Минимальная частотность перевода (fr из Yandex API)
// fr=1 — очень редкие переводы (град=city), fr=10 — популярные
export const MIN_FREQUENCY = 2;

// Фильтр: перевод должен содержать хотя бы одну кириллическую букву
// Исключает латинские термины типа "Plus", "Wi-Fi" и т.д.
export const CYRILLIC_FILTER = sql`${wordMeanings.translation} ~ '[а-яА-ЯёЁ]'`;

// Слова, у которых перевод нужно показывать с синонимами рода
const TRANSLATION_DISPLAY: Record<string, Record<string, string>> = {
  'it': { 'он': 'он, она, оно' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function randomDirection(pair: LanguagePair = DEFAULT_LANG_PAIR, fixed?: LanguagePair): LanguagePair {
  if (fixed) return fixed;
  return Math.random() < 0.5 ? pair : reversePair(pair);
}

export function getAllTranslations(meaning: { translation: string; alternativeTranslations: string[] | null }): string[] {
  return [meaning.translation, ...(meaning.alternativeTranslations ?? [])];
}

/** Собирает уникальные тексты вариантов из результатов запроса */
function collectUniqueOptions(
  rows: { translation: string; word: { text: string } }[],
  isForward: boolean,
  usedTexts: Set<string>,
  result: string[],
  target: number,
) {
  for (const row of rows) {
    if (result.length >= target) break;
    const text = isForward ? row.translation : row.word.text;
    if (!usedTexts.has(text)) {
      usedTexts.add(text);
      result.push(text);
    }
  }
}

// ─── Filters ────────────────────────────────────────────────────────────────

export function getPopularityFilter() {
  return or(
    isNull(wordMeanings.popularityRank),
    lte(wordMeanings.popularityRank, MAX_POPULARITY_RANK),
  );
}

export function getFrequencyFilter() {
  return or(
    isNull(wordMeanings.frequency),
    gte(wordMeanings.frequency, MIN_FREQUENCY),
  );
}

// ─── Generate from DB meanings ──────────────────────────────────────────────

export async function generateFromMeaning(
  correct: PooledMeaning,
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  fixedDirection?: LanguagePair,
): Promise<LegacyQuestion> {
  const popularityFilter = getPopularityFilter();
  const frequencyFilter = getFrequencyFilter();

  // Все переводы правильного значения (primary + alternatives)
  const correctTranslations = getAllTranslations(correct);
  const correctTranslationsSet = new Set(correctTranslations);
  // Все английские формы правильного слова
  const correctWordTexts = new Set([correct.word.text, ...(correct.word.lemma ? [correct.word.lemma] : [])]);

  const direction = randomDirection(langPair, fixedDirection);
  const isForward = direction === langPair;

  // Собираем уникальные варианты с дедупликацией по тексту опции
  const usedOptionTexts = new Set(isForward ? correctTranslationsSet : correctWordTexts);
  const wrongTexts: string[] = [];

  // Шаг 1: та же часть речи и сложность
  const step1 = await db.query.wordMeanings.findMany({
    where: and(
      popularityFilter, frequencyFilter, CYRILLIC_FILTER,
      ne(wordMeanings.id, correct.id),
      eq(wordMeanings.difficulty, correct.difficulty),
      eq(wordMeanings.partOfSpeech, correct.partOfSpeech),
      sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
    ),
    with: { word: true },
    limit: 10,
    orderBy: sql`RANDOM()`,
  });
  collectUniqueOptions(step1, isForward, usedOptionTexts, wrongTexts, 3);

  // Шаг 2: та же сложность, любая часть речи
  if (wrongTexts.length < 3) {
    const step2 = await db.query.wordMeanings.findMany({
      where: and(
        popularityFilter, frequencyFilter, CYRILLIC_FILTER,
        ne(wordMeanings.id, correct.id),
        eq(wordMeanings.difficulty, correct.difficulty),
        sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
      ),
      with: { word: true },
      limit: 10,
      orderBy: sql`RANDOM()`,
    });
    collectUniqueOptions(step2, isForward, usedOptionTexts, wrongTexts, 3);
  }

  // Шаг 3: любая сложность
  if (wrongTexts.length < 3) {
    const step3 = await db.query.wordMeanings.findMany({
      where: and(
        popularityFilter, frequencyFilter, CYRILLIC_FILTER,
        ne(wordMeanings.id, correct.id),
        sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
      ),
      with: { word: true },
      limit: 10,
      orderBy: sql`RANDOM()`,
    });
    collectUniqueOptions(step3, isForward, usedOptionTexts, wrongTexts, 3);
  }

  if (isForward) {
    const lemma = correct.word.lemma;
    const wordKey = (lemma ?? correct.word.text).toLowerCase();
    const displayTranslation = TRANSLATION_DISPLAY[wordKey]?.[correct.translation] ?? correct.translation;
    const options = shuffle([displayTranslation, ...wrongTexts]);
    return {
      meaningId: correct.id,
      word: lemma ?? correct.word.text,
      originalForm: lemma ? correct.word.text : null,
      transcription: correct.word.transcription,
      correctTranslation: displayTranslation,
      options,
      direction,
    };
  } else {
    const options = shuffle([correct.word.text, ...wrongTexts]);
    return {
      meaningId: correct.id,
      word: correct.translation,
      originalForm: null,
      transcription: null,
      correctTranslation: correct.word.text,
      options,
      direction,
    };
  }
}

// ─── Generate from Custom Word ──────────────────────────────────────────────

export async function generateFromCustomWord(
  correct: CustomWordForQuiz,
  allCustom: CustomWordForQuiz[],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  fixedDirection?: LanguagePair,
): Promise<LegacyQuestion> {
  const popularityFilter = getPopularityFilter();
  const frequencyFilter = getFrequencyFilter();

  const direction = randomDirection(langPair, fixedDirection);
  const isForward = direction === langPair;

  if (isForward) {
    // en-ru: показываем английское слово, варианты — переводы
    const otherTranslations = shuffle(
      allCustom.filter((w) => w.id !== correct.id && w.translation !== correct.translation),
    );
    const wrongTranslations: string[] = otherTranslations.slice(0, 3).map((w) => w.translation);

    // Добиваем из БД если не хватает
    if (wrongTranslations.length < 3) {
      const dbWrong = await db.query.wordMeanings.findMany({
        where: and(popularityFilter, frequencyFilter, CYRILLIC_FILTER, ne(wordMeanings.translation, correct.translation)),
        limit: 3 - wrongTranslations.length,
        orderBy: sql`RANDOM()`,
      });
      wrongTranslations.push(...dbWrong.map((m) => m.translation));
    }

    const options = shuffle([correct.translation, ...wrongTranslations]);
    return {
      meaningId: -correct.id, // Отрицательный id = кастомное слово
      word: correct.wordText,
      originalForm: null,
      transcription: null,
      correctTranslation: correct.translation,
      options,
      direction,
    };
  } else {
    // ru-en: показываем перевод, варианты — английские слова
    const otherWords = shuffle(
      allCustom.filter((w) => w.id !== correct.id && w.wordText !== correct.wordText),
    );
    const wrongWords: string[] = otherWords.slice(0, 3).map((w) => w.wordText);

    if (wrongWords.length < 3) {
      const dbWrong = await db.query.wordMeanings.findMany({
        where: and(popularityFilter, frequencyFilter, ne(wordMeanings.translation, correct.translation)),
        with: { word: true },
        limit: 3 - wrongWords.length,
        orderBy: sql`RANDOM()`,
      });
      wrongWords.push(...dbWrong.map((m) => m.word.text));
    }

    const options = shuffle([correct.wordText, ...wrongWords]);
    return {
      meaningId: -correct.id,
      word: correct.translation,
      originalForm: null,
      transcription: null,
      correctTranslation: correct.wordText,
      options,
      direction,
    };
  }
}

// ─── Generate random from all DB ────────────────────────────────────────────

export async function generateRandom(
  excludeMeaningIds: number[] = [],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  fixedDirection?: LanguagePair,
): Promise<LegacyQuestion | null> {
  const popularityFilter = getPopularityFilter();
  const frequencyFilter = getFrequencyFilter();

  const excludeCondition = excludeMeaningIds.length > 0
    ? sql`${wordMeanings.id} NOT IN (${sql.join(excludeMeaningIds.map(id => sql`${id}`), sql`, `)})`
    : undefined;

  const candidates = await db.query.wordMeanings.findMany({
    where: and(popularityFilter, frequencyFilter, excludeCondition),
    with: { word: true },
    limit: 1,
    orderBy: sql`RANDOM()`,
  });

  if (candidates.length === 0) return null;

  const correct = candidates[0]!;
  return generateFromMeaning(correct as PooledMeaning, langPair, fixedDirection);
}
