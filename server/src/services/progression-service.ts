/**
 * Progression Service
 *
 * Централизованная система начисления XP, уровней и League Points.
 * Все изменения XP/LP должны проходить через этот сервис.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import {
  XP_CORRECT_ANSWER,
  XP_STREAK_DAYS_BONUS,
  XP_DUEL_WIN,
  calculateLevel,
  getXpModifier,
  getLpModifier,
  applyModifier,
} from '../config/progression-config.js';
import {
  addLpForCorrectAnswer as addLpForCorrectAnswerInternal,
  addLpForQuizComplete,
  addLpForDuelWin,
  addLpForStreak,
} from './league-service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type XpGainResult = {
  xpEarned: number;
  xpModifier: number; // модификатор в процентах (100 = x1.0)
  totalXp: number;
  level: number;
  levelUp?: number; // новый уровень, если произошёл level up
};

export type CorrectAnswerResult = XpGainResult & {
  lpEarned: number;
  lpModifier: number; // модификатор в процентах (100 = x1.0)
  totalLp: number;
};

// ─── Core XP Functions ───────────────────────────────────────────────────────

/**
 * Добавляет XP пользователю и обновляет уровень.
 * Это низкоуровневая функция — для большинства случаев используйте
 * специализированные функции ниже.
 */
export async function addXp(
  userId: number,
  amount: number,
): Promise<XpGainResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { xp: true, level: true },
  });

  if (!user) throw new Error('Пользователь не найден');

  const newXp = user.xp + amount;
  const newLevel = calculateLevel(newXp);
  const levelUp = newLevel > user.level ? newLevel : undefined;

  await db
    .update(users)
    .set({
      xp: newXp,
      level: newLevel,
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return {
    xpEarned: amount,
    xpModifier: 100,
    totalXp: newXp,
    level: newLevel,
    levelUp,
  };
}

/**
 * Добавляет XP с модификатором streak.
 */
export async function addXpWithStreak(
  userId: number,
  baseAmount: number,
  streak: number,
): Promise<XpGainResult> {
  const xpModifier = getXpModifier(streak);
  const xpEarned = applyModifier(baseAmount, xpModifier);

  const result = await addXp(userId, xpEarned);
  return {
    ...result,
    xpModifier,
  };
}

// ─── High-Level Reward Functions ─────────────────────────────────────────────

/**
 * Начисляет награду за правильный ответ в квизе.
 * Применяет streak-модификаторы к XP и LP.
 */
export async function rewardCorrectAnswer(
  userId: number,
  streak: number = 0,
): Promise<CorrectAnswerResult> {
  // XP с модификатором
  const xpResult = await addXpWithStreak(userId, XP_CORRECT_ANSWER, streak);

  // LP с модификатором
  const lpModifier = getLpModifier(streak);
  const lpResult = await addLpForCorrectAnswerInternal(userId, streak);

  return {
    ...xpResult,
    lpEarned: lpResult.lpEarned,
    lpModifier,
    totalLp: lpResult.totalLp,
  };
}

/**
 * Начисляет награду за победу в дуэли.
 * Возвращает SQL-выражения для использования в batch-update.
 */
export function getDuelWinRewardSql() {
  return {
    xp: sql`${users.xp} + ${XP_DUEL_WIN}`,
    level: sql`floor(sqrt((${users.xp} + ${XP_DUEL_WIN}) / 10000)) + 1`,
  };
}

/**
 * Начисляет награду за победу в дуэли (полная версия с LP).
 */
export async function rewardDuelWin(userId: number): Promise<XpGainResult> {
  const result = await addXp(userId, XP_DUEL_WIN);
  await addLpForDuelWin(userId);
  return result;
}

/**
 * Начисляет награду за завершение квиз-сессии.
 * Включает бонус за streak дней.
 */
export async function rewardQuizSessionComplete(
  userId: number,
  correctCount: number,
  streakDays: number,
): Promise<XpGainResult & { streakBonus: number }> {
  // Базовый XP за правильные ответы
  const baseXp = correctCount * XP_CORRECT_ANSWER;

  // Бонус за streak дней
  const streakBonus = XP_STREAK_DAYS_BONUS * streakDays;

  const totalXpEarned = baseXp + streakBonus;
  const result = await addXp(userId, totalXpEarned);

  // LP за завершение квиза и streak
  await addLpForQuizComplete(userId);
  await addLpForStreak(userId, streakDays);

  return {
    ...result,
    xpEarned: totalXpEarned,
    streakBonus,
  };
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Обновляет streak дней пользователя.
 * Возвращает новое значение streak.
 */
export async function updateStreakDays(userId: number): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streakDays: true, lastActivityAt: true },
  });

  if (!user) throw new Error('Пользователь не найден');

  const now = new Date();
  const lastActivity = user.lastActivityAt;
  let newStreakDays = user.streakDays;

  if (lastActivity) {
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours >= 24 && diffHours < 48) {
      newStreakDays += 1;
    } else if (diffHours >= 48) {
      newStreakDays = 1;
    }
    // < 24 часов — streak не меняется (уже играли сегодня)
  } else {
    newStreakDays = 1;
  }

  if (newStreakDays !== user.streakDays) {
    await db
      .update(users)
      .set({
        streakDays: newStreakDays,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  return newStreakDays;
}

// ─── Re-exports for convenience ──────────────────────────────────────────────

export {
  calculateLevel,
  getXpModifier,
  getLpModifier,
  applyModifier,
  XP_CORRECT_ANSWER,
  XP_STREAK_DAYS_BONUS,
  XP_DUEL_WIN,
} from '../config/progression-config.js';
