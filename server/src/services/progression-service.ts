/**
 * Progression Service
 *
 * Централизованная система начисления XP, уровней и League Points.
 * Все изменения XP/LP должны проходить через этот сервис.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, streakActivityDays } from '../db/schema.js';
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
  GEMS_DAILY_PLAY,
  GEMS_LEVEL_UP,
  GEMS_STREAK_7_DAYS,
} from '../config/gems-config.js';
import { PILOT_FEATURES } from '../config/pilot-config.js';
import { XP_BOOST_MULTIPLIER, PREMIUM_XP_BONUS } from '../config/xp-boost-config.js';
import {
  addLpForCorrectAnswer as addLpForCorrectAnswerInternal,
  addLpForQuizComplete,
  addLpForDuelWin,
  addLpForStreak,
} from './league-service.js';
import { getMskTodayStart, toMskDayStart } from '../lib/msk-date.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type XpGainResult = {
  xpEarned: number;
  xpModifier: number; // модификатор в процентах (100 = x1.0)
  totalXp: number;
  level: number;
  levelUp?: number; // новый уровень, если произошёл level up
  gemsEarned: number; // гемы за level-up (0 если не было)
};

export type CorrectAnswerResult = XpGainResult & {
  lpEarned: number;
  lpModifier: number; // модификатор в процентах (100 = x1.0)
  totalLp: number;
};

export type StreakUpdateResult = {
  streakDays: number;
  gemsEarned: number;
  freezeUsed: boolean;
};

// ─── Core Gems Function ─────────────────────────────────────────────────────

/**
 * Атомарно добавляет гемы пользователю.
 * Возвращает новое значение gems.
 *
 * При выключенном PILOT_FEATURES.gems — no-op: возвращает текущий баланс
 * без записи. Это отключает всю экономику гемов одной точкой, не трогая
 * вызовы из milestones/streak/level-up/duels/quiz-streak.
 */
export async function addGems(userId: number, amount: number): Promise<number> {
  if (!PILOT_FEATURES.gems) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { gems: true },
    });
    return user?.gems ?? 0;
  }

  const [result] = await db
    .update(users)
    .set({
      gems: sql`${users.gems} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ gems: users.gems });

  return result.gems;
}

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

  // Гемы за level-up
  let gemsEarned = 0;
  if (levelUp && PILOT_FEATURES.gems) {
    await addGems(userId, GEMS_LEVEL_UP);
    gemsEarned = GEMS_LEVEL_UP;
  }

  return {
    xpEarned: amount,
    xpModifier: 100,
    totalXp: newXp,
    level: newLevel,
    levelUp,
    gemsEarned,
  };
}

/**
 * Глобальный множитель XP (Premium + XP Boost).
 * Складываются аддитивно: base(100) + premium(50) + boost(50) = 200 = x2.
 */
async function getGlobalXpMultiplier(userId: number): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { premiumUntil: true, xpBoostUntil: true },
  });

  let multiplier = 100;
  const now = new Date();

  if (user?.premiumUntil && user.premiumUntil > now) {
    multiplier += PREMIUM_XP_BONUS;
  }
  if (user?.xpBoostUntil && user.xpBoostUntil > now) {
    multiplier += XP_BOOST_MULTIPLIER;
  }

  return multiplier;
}

/**
 * Добавляет XP с модификатором streak и глобальным множителем (Premium + Boost).
 */
export async function addXpWithStreak(
  userId: number,
  baseAmount: number,
  streak: number,
): Promise<XpGainResult> {
  const xpModifier = getXpModifier(streak);
  let xpEarned = applyModifier(baseAmount, xpModifier);

  // Глобальный множитель (Premium + XP Boost)
  const globalMultiplier = await getGlobalXpMultiplier(userId);
  if (globalMultiplier > 100) {
    xpEarned = applyModifier(xpEarned, globalMultiplier);
  }

  const result = await addXp(userId, xpEarned);
  return {
    ...result,
    xpModifier: Math.floor((xpModifier * globalMultiplier) / 100),
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
  baseXp: number = XP_CORRECT_ANSWER,
): Promise<CorrectAnswerResult> {
  // XP с модификатором
  const xpResult = await addXpWithStreak(userId, baseXp, streak);

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
    level: sql`CASE WHEN ${users.xp} + ${XP_DUEL_WIN} < 100 THEN 1 ELSE floor(power((${users.xp} + ${XP_DUEL_WIN}) / 100.0, 1.0/2.2)) + 1 END`,
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
 * Включает: заморозку стрика, гемы за первый вход, мильники стрика.
 */
export async function updateStreakDays(userId: number): Promise<StreakUpdateResult> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streakDays: true, streakFreezes: true, lastLoginDate: true },
  });

  if (!user) throw new Error('Пользователь не найден');

  const now = new Date();
  const lastLogin = user.lastLoginDate;
  let newStreakDays = user.streakDays;
  let freezesUsed = 0;
  let gemsEarned = 0;

  // Сбрасываем время до начала дня (МСК) для сравнения календарных дней
  const todayStart = getMskTodayStart(now);

  if (lastLogin) {
    const lastLoginStart = toMskDayStart(lastLogin);

    // Разница в днях
    const diffDays = Math.floor((todayStart.getTime() - lastLoginStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Уже заходили сегодня — streak не меняется
      return { streakDays: user.streakDays, gemsEarned: 0, freezeUsed: false };
    } else if (diffDays === 1) {
      // Вчера был вход — увеличиваем streak
      newStreakDays += 1;
    } else {
      // Пропуск N дней — пробуем покрыть заморозками
      const missedDays = diffDays - 1; // дни без активности (не считая сегодня)
      if (user.streakFreezes >= missedDays) {
        // Хватает заморозок — streak сохраняется
        freezesUsed = missedDays;
      } else {
        // Не хватает заморозок — сброс streak
        newStreakDays = 1;
      }
    }
  } else {
    // Первый вход
    newStreakDays = 1;
  }

  if (PILOT_FEATURES.gems) {
    // Гемы за первый квиз за день
    gemsEarned += GEMS_DAILY_PLAY;

    // Гемы за мильник стрика (каждые 7 дней)
    if (newStreakDays > 0 && newStreakDays % 7 === 0 && newStreakDays !== user.streakDays) {
      gemsEarned += GEMS_STREAK_7_DAYS;
    }
  }

  // Обновляем пользователя
  const updateData: Record<string, unknown> = {
    streakDays: newStreakDays,
    maxStreakDays: sql`GREATEST(${users.maxStreakDays}, ${newStreakDays})`,
    lastLoginDate: now,
    updatedAt: new Date(),
  };

  if (freezesUsed > 0) {
    updateData.streakFreezes = user.streakFreezes - freezesUsed;
  }

  await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId));

  // Начисляем гемы
  if (gemsEarned > 0) {
    await addGems(userId, gemsEarned);
  }

  // Записываем активность в историю стрика
  await db
    .insert(streakActivityDays)
    .values({ userId, date: todayStart, type: 'play' })
    .onConflictDoNothing();

  // Если использовались заморозки — записываем freeze-дни
  if (freezesUsed > 0 && lastLogin) {
    const lastLoginStart = toMskDayStart(lastLogin);
    const freezeRecords: { userId: number; date: Date; type: string }[] = [];
    for (let i = 1; i <= freezesUsed; i++) {
      const freezeDate = new Date(lastLoginStart.getTime() + i * 24 * 60 * 60 * 1000);
      freezeRecords.push({ userId, date: freezeDate, type: 'freeze' });
    }
    if (freezeRecords.length > 0) {
      await db
        .insert(streakActivityDays)
        .values(freezeRecords)
        .onConflictDoNothing();
    }
  }

  return { streakDays: newStreakDays, gemsEarned, freezeUsed: freezesUsed > 0 };
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
