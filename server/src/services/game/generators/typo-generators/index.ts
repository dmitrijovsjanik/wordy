import type { TypoGenerator, TypoResult, CombinatorConfig } from './types.js';
import { DoubleLetterGenerator } from './double-letter.js';
import { PhoneticGenerator } from './phonetic.js';
import { TranspositionGenerator } from './transposition.js';
import { SuffixGenerator } from './suffix.js';
import { SilentLetterGenerator } from './silent-letter.js';
import { findAllAxes, selectTwoAxes, generateMatrix } from './axis-finder.js';

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
 * Генерирует варианты с использованием 2-осевой стратегии (2x2 матрица)
 * Каждый признак ошибки встречается в ≥2 вариантах → нельзя определить правильный по одному признаку
 *
 * @returns 4 варианта (включая правильный) или null если не хватает осей
 */
function generatePairedOptions(correctWord: string): string[] | null {
  const axes = findAllAxes(correctWord);
  const pair = selectTwoAxes(axes);

  if (!pair) return null;

  const [axisA, axisB] = pair;
  const [correct, wrongA, wrongB, wrongAB] = generateMatrix(correctWord, axisA, axisB);

  // Проверяем уникальность всех 4 вариантов
  const uniqueSet = new Set([correct, wrongA, wrongB, wrongAB].map(s => s.toLowerCase()));
  if (uniqueSet.size < 4) return null;

  return [correct, wrongA, wrongB, wrongAB];
}

/**
 * Генерирует полный набор вариантов для spelling quiz
 * Использует 2-осевую стратегию (paired), с fallback на старый алгоритм
 *
 * @param correctWord - Правильное написание
 * @param totalOptions - Общее количество вариантов включая правильный (default: 4)
 * @param seed - Опциональный seed для детерминизма
 * @returns Перемешанный массив вариантов
 */
export function generateSpellingOptions(
  correctWord: string,
  totalOptions: number = 4,
  seed?: number,
): string[] {
  // 1. Пробуем 2-осевую стратегию
  const paired = generatePairedOptions(correctWord);
  if (paired) {
    return shuffle(paired, seed);
  }

  // 2. Fallback: 1 ось + старый генератор
  const axes = findAllAxes(correctWord);
  if (axes.length > 0) {
    const axis = axes[0]!;
    const wrongVariant = correctWord.slice(0, axis.start) + axis.wrong + correctWord.slice(axis.end);

    // Добираем из старого генератора
    const oldTypos = generateTypoVariants(correctWord, {
      totalVariants: totalOptions - 1,
      seed,
    });

    // Убираем дубликаты с осевым вариантом
    const filtered = oldTypos.filter(t => t.toLowerCase() !== wrongVariant.toLowerCase());
    const needed = totalOptions - 2; // -1 correct -1 axis variant
    const extras = filtered.slice(0, needed);

    const options = [correctWord, wrongVariant, ...extras];
    // Если всё ещё не хватает — добираем из оставшихся
    if (options.length < totalOptions) {
      const remaining = filtered.slice(needed, needed + (totalOptions - options.length));
      options.push(...remaining);
    }
    return shuffle(options.slice(0, totalOptions), seed);
  }

  // 3. Полный fallback на старый алгоритм
  const typos = generateTypoVariants(correctWord, {
    totalVariants: totalOptions - 1,
    seed,
  });

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
