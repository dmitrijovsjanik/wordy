// ─── Answer Check Utility ─────────────────────────────────────────────────────
// Fuzzy matching для проверки пользовательского ввода (free-recall, dictation)

export type AnswerResult = 'exact' | 'close' | 'wrong';

/**
 * Нормализация строки для сравнения:
 * - trim + lowercase
 * - ё → е (для русского)
 */
function normalize(str: string): string {
  return str.trim().toLowerCase().replace(/ё/g, 'е');
}

/**
 * Расстояние Левенштейна (стандартный DP-алгоритм)
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Оптимизация для пустых строк
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array.from({ length: n + 1 }, () => 0),
  );

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,       // удаление
        dp[i]![j - 1]! + 1,       // вставка
        dp[i - 1]![j - 1]! + cost, // замена
      );
    }
  }

  return dp[m]![n]!;
}

/**
 * Проверяет ответ пользователя против списка допустимых ответов.
 *
 * 1. Нормализация: trim, lowercase, ё → е
 * 2. Точное совпадение с любым допустимым ответом → 'exact'
 * 3. Если длина слова > 5: Левенштейн <= 1 → 'close' (почти правильно)
 * 4. Иначе → 'wrong'
 */
export function checkAnswer(
  input: string,
  acceptableAnswers: string[],
): AnswerResult {
  const normalizedInput = normalize(input);

  if (!normalizedInput) return 'wrong';

  const normalizedAnswers = acceptableAnswers.map(normalize);

  // Точное совпадение
  if (normalizedAnswers.includes(normalizedInput)) {
    return 'exact';
  }

  // Fuzzy match (только для слов длиннее 5 символов)
  for (const answer of normalizedAnswers) {
    if (answer.length > 5 && levenshtein(normalizedInput, answer) <= 1) {
      return 'close';
    }
  }

  return 'wrong';
}
