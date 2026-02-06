import type { PooledMeaning, CustomWordForQuiz, SpellingQuestion } from '../types.js';
import { generateSpellingOptions } from './typo-generators/index.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Минимальная длина слова для spelling вопросов
 * Короткие слова (≤3 букв) сложно генерировать с опечатками
 */
const MIN_WORD_LENGTH = 4;

// ─── Generation ──────────────────────────────────────────────────────────────

/**
 * Проверяет, подходит ли слово для spelling вопроса
 */
export function canGenerateSpelling(word: string): boolean {
  return word.length >= MIN_WORD_LENGTH;
}

/**
 * Генерирует spelling вопрос из meaning
 * Показывает русский перевод, варианты — английские написания
 *
 * @throws Если слово слишком короткое (< 4 букв)
 */
export function generateSpellingFromMeaning(
  correct: PooledMeaning,
  seed?: number,
): SpellingQuestion | null {
  const englishWord = correct.word.lemma ?? correct.word.text;

  // Пропускаем короткие слова
  if (!canGenerateSpelling(englishWord)) {
    return null;
  }

  const options = generateSpellingOptions(englishWord, 6, seed);

  return {
    type: 'spelling',
    meaningId: correct.id,
    word: correct.translation,
    options,
    correctSpelling: englishWord,
    direction: 'ru-en',
  };
}

/**
 * Генерирует spelling вопрос из кастомного слова пользователя
 *
 * @throws Если слово слишком короткое (< 4 букв)
 */
export function generateSpellingFromCustomWord(
  correct: CustomWordForQuiz,
  seed?: number,
): SpellingQuestion | null {
  // Пропускаем короткие слова
  if (!canGenerateSpelling(correct.wordText)) {
    return null;
  }

  const options = generateSpellingOptions(correct.wordText, 6, seed);

  return {
    type: 'spelling',
    meaningId: -correct.id, // Отрицательный ID для кастомных
    word: correct.translation,
    options,
    correctSpelling: correct.wordText,
    direction: 'ru-en',
  };
}
