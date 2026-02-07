// ─── Level Configuration (синхронизирован с server/src/config/progression-config.ts) ───

/**
 * Рассчитывает уровень на основе общего XP.
 * Формула: level = floor((xp / 100) ^ (1/2.2)) + 1
 *
 * Примеры (в ответах по 100 XP):
 * - 0 XP = уровень 1
 * - 100 XP = уровень 2    (1 ответ)
 * - 460 XP = уровень 3    (5 ответов)
 * - 2735 XP = уровень 5   (27 ответов)
 * - 25764 XP = уровень 10 (258 ответов)
 */
export function calculateLevel(xp: number): number {
  if (xp < 100) return 1;
  return Math.floor(Math.pow(xp / 100, 1 / 2.2)) + 1;
}

/**
 * Рассчитывает XP, необходимый для достижения определённого уровня.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(100 * Math.pow(level - 1, 2.2));
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
