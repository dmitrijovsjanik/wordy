import { ne, and, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { wordMeanings } from '../../../db/schema.js';
import type { PooledMeaning, ClozeQuestion } from '../types.js';
import { shuffle, getPopularityFilter, getFrequencyFilter } from './multiple-choice.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Минимальное количество слов в предложении для cloze */
const MIN_SENTENCE_WORDS = 4;

/** Максимальное количество слов в предложении для cloze */
const MAX_SENTENCE_WORDS = 15;

/** Количество вариантов ответа (включая правильный) */
const TOTAL_OPTIONS = 4;

/** Количество дистракторов */
const DISTRACTORS_COUNT = TOTAL_OPTIONS - 1;

/** Плейсхолдер для пропуска */
const BLANK = '_____';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Находит подходящий пример предложения, содержащий целевое слово.
 * Возвращает первый подходящий пример или null.
 */
function findSuitableExample(
  examples: { text: string; translation: string }[],
  word: string,
): { text: string; translation: string } | null {
  const wordLower = word.toLowerCase();

  for (const example of examples) {
    const wordCount = example.text.split(/\s+/).length;
    if (wordCount < MIN_SENTENCE_WORDS || wordCount > MAX_SENTENCE_WORDS) continue;

    // Проверяем наличие слова (case-insensitive, как отдельное слово)
    const regex = new RegExp(`\\b${escapeRegExp(wordLower)}\\b`, 'i');
    if (regex.test(example.text)) {
      return example;
    }
  }

  return null;
}

/** Экранирование спецсимволов для RegExp */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Заменяет целевое слово на пропуск в предложении.
 * Заменяет только первое вхождение.
 */
function replaceWordWithBlank(sentence: string, word: string): string {
  const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  return sentence.replace(regex, BLANK);
}

/** Собирает уникальные lemma/text из результатов запроса */
function collectUniqueWords(
  rows: { word: { lemma: string | null; text: string } }[],
  usedWords: Set<string>,
  result: string[],
  target: number,
) {
  for (const row of rows) {
    if (result.length >= target) break;
    const w = row.word.lemma ?? row.word.text;
    const lower = w.toLowerCase();
    if (!usedWords.has(lower)) {
      usedWords.add(lower);
      result.push(w);
    }
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Проверяет, можно ли сгенерировать cloze вопрос из данного meaning.
 * Требует наличие примеров, где целевое слово присутствует в тексте.
 */
export function canGenerateCloze(meaning: PooledMeaning): boolean {
  if (!meaning.examples || meaning.examples.length === 0) return false;

  const word = meaning.word.lemma ?? meaning.word.text;
  return findSuitableExample(meaning.examples, word) !== null;
}

/**
 * Генерирует cloze вопрос: предложение с пропуском + 4 варианта ответа.
 * Дистракторы загружаются из БД (английские слова похожей сложности).
 */
export async function generateClozeFromMeaning(
  correct: PooledMeaning,
): Promise<ClozeQuestion | null> {
  if (!correct.examples || correct.examples.length === 0) return null;

  const word = correct.word.lemma ?? correct.word.text;
  const example = findSuitableExample(correct.examples, word);

  if (!example) return null;

  const popularityFilter = getPopularityFilter();
  const frequencyFilter = getFrequencyFilter();

  const usedWords = new Set<string>([word.toLowerCase()]);
  const distractors: string[] = [];

  // Шаг 1: та же часть речи и сложность
  const step1 = await db.query.wordMeanings.findMany({
    where: and(
      popularityFilter, frequencyFilter,
      ne(wordMeanings.id, correct.id),
      sql`${wordMeanings.difficulty} = ${correct.difficulty}`,
      sql`${wordMeanings.partOfSpeech} = ${correct.partOfSpeech}`,
    ),
    with: { word: true },
    columns: { id: true },
    limit: 10,
    orderBy: sql`RANDOM()`,
  });
  collectUniqueWords(step1 as unknown as { word: { lemma: string | null; text: string } }[], usedWords, distractors, DISTRACTORS_COUNT);

  // Шаг 2: та же сложность, любая часть речи
  if (distractors.length < DISTRACTORS_COUNT) {
    const step2 = await db.query.wordMeanings.findMany({
      where: and(
        popularityFilter, frequencyFilter,
        ne(wordMeanings.id, correct.id),
        sql`${wordMeanings.difficulty} = ${correct.difficulty}`,
      ),
      with: { word: true },
      columns: { id: true },
      limit: 10,
      orderBy: sql`RANDOM()`,
    });
    collectUniqueWords(step2 as unknown as { word: { lemma: string | null; text: string } }[], usedWords, distractors, DISTRACTORS_COUNT);
  }

  // Шаг 3: любая сложность
  if (distractors.length < DISTRACTORS_COUNT) {
    const step3 = await db.query.wordMeanings.findMany({
      where: and(
        popularityFilter, frequencyFilter,
        ne(wordMeanings.id, correct.id),
      ),
      with: { word: true },
      columns: { id: true },
      limit: 10,
      orderBy: sql`RANDOM()`,
    });
    collectUniqueWords(step3 as unknown as { word: { lemma: string | null; text: string } }[], usedWords, distractors, DISTRACTORS_COUNT);
  }

  // Если не хватает дистракторов — не генерируем
  if (distractors.length < DISTRACTORS_COUNT) return null;

  const sentence = replaceWordWithBlank(example.text, word);
  const options = shuffle([word, ...distractors]);

  return {
    type: 'cloze',
    meaningId: correct.id,
    sentence,
    sentenceRu: example.translation,
    options,
    correctAnswer: word,
    word,
    transcription: correct.word.transcription,
  };
}
