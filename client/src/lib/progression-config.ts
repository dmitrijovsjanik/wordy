// ─── Level Configuration (синхронизирован с server/src/config/progression-config.ts) ───

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
