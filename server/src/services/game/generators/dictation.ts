import type { PooledMeaning, DictationQuestion } from '../types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Минимальная длина слова для dictation вопросов */
const MIN_WORD_LENGTH = 4;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Проверяет, подходит ли слово для dictation вопроса.
 * Слишком короткие слова (< 4 букв) тривиальны для диктанта.
 */
export function canGenerateDictation(word: string): boolean {
  return word.length >= MIN_WORD_LENGTH;
}

/**
 * Генерирует dictation вопрос: пользователь слышит английское слово через TTS,
 * видит русский перевод как подсказку и должен написать слово.
 */
export function generateDictationFromMeaning(
  correct: PooledMeaning,
): DictationQuestion | null {
  const word = correct.word.lemma ?? correct.word.text;

  if (word.length < MIN_WORD_LENGTH) return null;

  // Допустимые варианты: лемма + оригинальная форма (если отличается)
  const acceptableSet = new Set<string>();
  acceptableSet.add(word.toLowerCase());
  if (correct.word.text.toLowerCase() !== word.toLowerCase()) {
    acceptableSet.add(correct.word.text.toLowerCase());
  }

  return {
    type: 'dictation',
    meaningId: correct.id,
    audioWord: word,
    hint: correct.translation,
    correctAnswer: word,
    acceptableAnswers: [...acceptableSet],
    partOfSpeech: correct.partOfSpeech,
  };
}
