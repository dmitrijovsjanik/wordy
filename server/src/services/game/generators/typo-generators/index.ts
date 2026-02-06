import type { TypoGenerator, TypoResult, CombinatorConfig } from './types.js';
import { DoubleLetterGenerator } from './double-letter.js';
import { PhoneticGenerator } from './phonetic.js';
import { TranspositionGenerator } from './transposition.js';
import { SuffixGenerator } from './suffix.js';
import { SilentLetterGenerator } from './silent-letter.js';

// Реэкспорт типов
export * from './types.js';

// ─── Generator Instances ─────────────────────────────────────────────────────

const generators: TypoGenerator[] = [
  new DoubleLetterGenerator(),
  new PhoneticGenerator(),
  new TranspositionGenerator(),
  new SuffixGenerator(),
  new SilentLetterGenerator(),
];

// Сортируем по приоритету (высший первый)
generators.sort((a, b) => b.priority - a.priority);

// ─── Shuffle Helper ──────────────────────────────────────────────────────────

function shuffle<T>(arr: T[], seed?: number): T[] {
  const result = [...arr];
  const rng = seed !== undefined ? seededRandom(seed) : Math.random;

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

// Простой seeded RNG (mulberry32)
function seededRandom(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Main API ────────────────────────────────────────────────────────────────

/**
 * Генерирует варианты опечаток для слова
 * Комбинирует результаты всех подгенераторов и выбирает лучшие по confidence
 *
 * @param word - Исходное слово
 * @param config - Конфигурация
 * @returns Массив уникальных опечаток (без исходного слова)
 */
export function generateTypoVariants(
  word: string,
  config: CombinatorConfig = {},
): string[] {
  const { totalVariants = 5, seed } = config;

  const allResults: TypoResult[] = [];

  // Собираем результаты от всех генераторов
  for (const generator of generators) {
    const results = generator.generate({
      word,
      maxVariants: totalVariants * 2, // Запрашиваем больше для лучшего выбора
      seed,
    });
    allResults.push(...results);
  }

  // Дедупликация
  const seen = new Set<string>();
  seen.add(word.toLowerCase()); // Исключаем исходное слово

  const uniqueResults = allResults.filter((r) => {
    const lower = r.variant.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  // Сортируем по confidence и берём top N
  const sorted = uniqueResults.sort((a, b) => b.confidence - a.confidence);
  return sorted.slice(0, totalVariants).map((r) => r.variant);
}

/**
 * Генерирует полный набор вариантов для spelling quiz
 * Включает правильный ответ и перемешивает
 *
 * @param correctWord - Правильное написание
 * @param totalOptions - Общее количество вариантов включая правильный (default: 6)
 * @param seed - Опциональный seed для детерминизма
 * @returns Перемешанный массив вариантов
 */
export function generateSpellingOptions(
  correctWord: string,
  totalOptions: number = 6,
  seed?: number,
): string[] {
  const typos = generateTypoVariants(correctWord, {
    totalVariants: totalOptions - 1,
    seed,
  });

  // Добавляем правильный ответ и перемешиваем
  const options = [correctWord, ...typos];
  return shuffle(options, seed);
}

/**
 * Получить все варианты с метаданными (для отладки)
 */
export function generateTypoVariantsWithMeta(
  word: string,
  config: CombinatorConfig = {},
): TypoResult[] {
  const { totalVariants = 5, seed } = config;

  const allResults: TypoResult[] = [];

  for (const generator of generators) {
    const results = generator.generate({
      word,
      maxVariants: totalVariants * 2,
      seed,
    });
    allResults.push(...results);
  }

  const seen = new Set<string>();
  seen.add(word.toLowerCase());

  const uniqueResults = allResults.filter((r) => {
    const lower = r.variant.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  return uniqueResults.sort((a, b) => b.confidence - a.confidence).slice(0, totalVariants);
}
