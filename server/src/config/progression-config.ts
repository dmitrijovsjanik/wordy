// ─── XP Configuration ────────────────────────────────────────────────────────
// Базовые значения XP (увеличенная разрядность для точных модификаторов)

export const XP_CORRECT_ANSWER = 100;
export const XP_STREAK_DAYS_BONUS = 50; // бонус за streak дней (при завершении сессии)
export const XP_DUEL_WIN = 500;
export const XP_QUIZ_COMPLETE_BONUS = 0; // можно добавить бонус за завершение квиза

// ─── Level Configuration ─────────────────────────────────────────────────────

/**
 * Рассчитывает уровень на основе общего XP.
 * Формула: level = floor(sqrt(xp / 10000)) + 1
 *
 * Примеры:
 * - 0-9999 XP = уровень 1
 * - 10000-39999 XP = уровень 2
 * - 40000-89999 XP = уровень 3
 * - 90000-159999 XP = уровень 4
 */
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 10000)) + 1;
}

/**
 * Рассчитывает XP, необходимый для достижения определённого уровня.
 */
export function xpForLevel(level: number): number {
  return Math.pow(level - 1, 2) * 10000;
}

/**
 * Рассчитывает прогресс до следующего уровня (0-1).
 */
export function levelProgress(xp: number): number {
  const currentLevel = calculateLevel(xp);
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  return (xp - currentLevelXp) / (nextLevelXp - currentLevelXp);
}

// ─── Streak Modifiers (ответы подряд в сессии) ───────────────────────────────
// Модификаторы в процентах: 100 = x1.0, 110 = x1.1, 115 = x1.15

export const STREAK_XP_START = 3; // минимальный streak для бонуса XP
export const STREAK_XP_BONUS_PERCENT = 10; // +10% за каждый ответ после порога
export const STREAK_LP_START = 5; // минимальный streak для бонуса LP
export const STREAK_LP_BONUS_PERCENT = 5; // +5% за каждый ответ после порога

/**
 * Рассчитывает модификатор XP на основе текущего streak.
 * @param streak - количество правильных ответов подряд
 * @returns множитель в процентах (100 = x1.0)
 *
 * Примеры:
 * - streak 0-2: 100% (без бонуса)
 * - streak 3: 110% (x1.1)
 * - streak 4: 120% (x1.2)
 * - streak 5: 130% (x1.3)
 */
export function getXpModifier(streak: number): number {
  if (streak < STREAK_XP_START) return 100;
  return 100 + (streak - STREAK_XP_START + 1) * STREAK_XP_BONUS_PERCENT;
}

/**
 * Рассчитывает модификатор LP на основе текущего streak.
 * @param streak - количество правильных ответов подряд
 * @returns множитель в процентах (100 = x1.0)
 *
 * Примеры:
 * - streak 0-4: 100% (без бонуса)
 * - streak 5: 105% (x1.05)
 * - streak 6: 110% (x1.10)
 * - streak 7: 115% (x1.15)
 */
export function getLpModifier(streak: number): number {
  if (streak < STREAK_LP_START) return 100;
  return 100 + (streak - STREAK_LP_START + 1) * STREAK_LP_BONUS_PERCENT;
}

/**
 * Применяет модификатор к базовому значению.
 * @param base - базовое значение
 * @param modifierPercent - модификатор в процентах (100 = x1.0)
 * @returns итоговое значение (целое число)
 */
export function applyModifier(base: number, modifierPercent: number): number {
  return Math.floor((base * modifierPercent) / 100);
}
