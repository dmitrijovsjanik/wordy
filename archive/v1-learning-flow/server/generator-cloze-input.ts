import type { PooledMeaning, ClozeInputQuestion } from '../types.js';

const MIN_SENTENCE_WORDS = 4;
const MAX_SENTENCE_WORDS = 15;
const BLANK = '_____';

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findSuitableExample(
  examples: { text: string; translation: string }[],
  word: string,
): { text: string; translation: string } | null {
  const wordLower = word.toLowerCase();
  for (const example of examples) {
    const wordCount = example.text.split(/\s+/).length;
    if (wordCount < MIN_SENTENCE_WORDS || wordCount > MAX_SENTENCE_WORDS) continue;
    const regex = new RegExp(`\\b${escapeRegExp(wordLower)}\\b`, 'i');
    if (regex.test(example.text)) return example;
  }
  return null;
}

function replaceWordWithBlank(sentence: string, word: string): string {
  const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  return sentence.replace(regex, BLANK);
}

/** Можно ли сгенерировать cloze-input — нужен подходящий пример с целевым словом. */
export function canGenerateClozeInput(meaning: PooledMeaning): boolean {
  if (!meaning.examples || meaning.examples.length === 0) return false;
  const word = meaning.word.lemma ?? meaning.word.text;
  return findSuitableExample(meaning.examples, word) !== null;
}

/**
 * Генерирует cloze-input: предложение с пропуском, без вариантов ответа.
 * Пользователь печатает пропущенное слово. Используется на production-tier'е
 * как контекстный recall (отличает уровень 4 от чистого free-recall на 3).
 */
export function generateClozeInputFromMeaning(
  correct: PooledMeaning,
): ClozeInputQuestion | null {
  if (!correct.examples || correct.examples.length === 0) return null;

  const word = correct.word.lemma ?? correct.word.text;
  const example = findSuitableExample(correct.examples, word);
  if (!example) return null;

  const sentence = replaceWordWithBlank(example.text, word);
  const acceptableAnswers = [
    correct.word.text,
    ...(correct.word.lemma ? [correct.word.lemma] : []),
  ].filter(Boolean);

  return {
    type: 'cloze-input',
    meaningId: correct.id,
    sentence,
    sentenceRu: example.translation,
    correctAnswer: word,
    acceptableAnswers: [...new Set(acceptableAnswers)],
    partOfSpeech: correct.partOfSpeech,
    word,
  };
}
