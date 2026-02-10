/**
 * Adaptive Difficulty
 *
 * Определяет уровень сложности на основе последних ответов пользователя.
 * Будет интегрирован в quiz-service для автоматической подстройки сложности.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type AdaptiveLevel = 'easy' | 'normal' | 'challenge';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Порог ошибок для снижения сложности (больше 50% ошибок) */
const ERROR_RATE_HIGH = 0.5;

/** Порог ошибок для повышения сложности (меньше 20% ошибок) */
const ERROR_RATE_LOW = 0.2;

/** Минимальное количество ответов для принятия решения */
const MIN_ANSWERS_FOR_ADAPTATION = 5;

// ─── Core Function ──────────────────────────────────────────────────────────

/**
 * Определяет уровень сложности на основе последних ответов.
 *
 * - errorRate > 0.5 -> 'easy' (слишком сложно, упрощаем)
 * - errorRate < 0.2 -> 'challenge' (слишком легко, усложняем)
 * - иначе -> 'normal' (баланс)
 *
 * Если ответов меньше MIN_ANSWERS_FOR_ADAPTATION — возвращает 'normal'.
 */
export function getAdaptiveLevel(
  recentCorrect: number,
  recentTotal: number,
): AdaptiveLevel {
  if (recentTotal < MIN_ANSWERS_FOR_ADAPTATION) {
    return 'normal';
  }

  const errorRate = 1 - recentCorrect / recentTotal;

  if (errorRate > ERROR_RATE_HIGH) {
    return 'easy';
  }

  if (errorRate < ERROR_RATE_LOW) {
    return 'challenge';
  }

  return 'normal';
}
