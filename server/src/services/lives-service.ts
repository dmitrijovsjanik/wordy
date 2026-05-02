/**
 * Lives (Hearts) Service
 *
 * 5 жизней, тратятся при ошибках в infinite quiz.
 * Полное восстановление через 4 часа или за 250 гемов.
 * Premium = бесконечные жизни.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { MAX_LIVES, LIVES_RECOVERY_MS, LIVES_REFILL_GEM_COST } from '../config/lives-config.js';
import { isPremium } from './premium-service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type LivesStatus = {
  lives: number;
  livesRestoredAt: string | null;
  isInfinite: boolean;
};

export type ConsumeLifeResult = {
  lives: number;
  livesRestoredAt: string | null;
  livesExhausted: boolean;
};

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Если таймер восстановления истёк — сбрасывает жизни до MAX и очищает таймер.
 * Возвращает актуальные значения.
 */
async function checkAndRestore(userId: number): Promise<{ lives: number; livesRestoredAt: Date | null }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { lives: true, livesRestoredAt: true },
  });

  if (!user) throw new Error('Пользователь не найден');

  const now = new Date();

  if (user.livesRestoredAt && now >= user.livesRestoredAt) {
    // Таймер истёк — восстановить полностью
    await db
      .update(users)
      .set({ lives: MAX_LIVES, livesRestoredAt: null, updatedAt: now })
      .where(eq(users.id, userId));
    return { lives: MAX_LIVES, livesRestoredAt: null };
  }

  return { lives: user.lives, livesRestoredAt: user.livesRestoredAt };
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Возвращает текущий статус жизней.
 * Автоматически восстанавливает если таймер истёк.
 */
export async function getLivesStatus(userId: number): Promise<LivesStatus> {
  const premium = await isPremium(userId);
  if (premium) {
    return { lives: MAX_LIVES, livesRestoredAt: null, isInfinite: true };
  }

  const { lives, livesRestoredAt } = await checkAndRestore(userId);
  return {
    lives,
    livesRestoredAt: livesRestoredAt?.toISOString() ?? null,
    isInfinite: false,
  };
}

/**
 * Тратит одну жизнь при неправильном ответе.
 * Premium — пропускает. Если таймер истёк — сначала восстанавливает.
 */
export async function consumeLife(userId: number): Promise<ConsumeLifeResult> {
  const premium = await isPremium(userId);
  if (premium) {
    return { lives: MAX_LIVES, livesRestoredAt: null, livesExhausted: false };
  }

  // Автовосстановление если таймер прошёл
  const current = await checkAndRestore(userId);

  // Если жизни уже 0 (не должно происходить, но на всякий)
  if (current.lives <= 0) {
    return {
      lives: 0,
      livesRestoredAt: current.livesRestoredAt?.toISOString() ?? null,
      livesExhausted: true,
    };
  }

  const newLives = current.lives - 1;
  const now = new Date();

  // Если это первая потеря (было MAX) — запускаем таймер восстановления
  const newRestoredAt = current.livesRestoredAt
    ? current.livesRestoredAt
    : new Date(now.getTime() + LIVES_RECOVERY_MS);

  await db
    .update(users)
    .set({
      lives: newLives,
      livesRestoredAt: newRestoredAt,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return {
    lives: newLives,
    livesRestoredAt: newRestoredAt.toISOString(),
    livesExhausted: newLives <= 0,
  };
}

/**
 * Полное восстановление жизней без списания гемов (для оплаты рублями через YooKassa).
 */
export async function refillLivesNoGems(userId: number): Promise<void> {
  await db
    .update(users)
    .set({ lives: MAX_LIVES, livesRestoredAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/**
 * Полное восстановление жизней за гемы.
 */
export async function refillLives(userId: number): Promise<{ lives: number; gems: number }> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { gems: true, lives: true },
  });

  if (!user) throw new Error('Пользователь не найден');

  if (user.gems < LIVES_REFILL_GEM_COST) {
    throw new Error('INSUFFICIENT_GEMS');
  }

  const [updated] = await db
    .update(users)
    .set({
      lives: MAX_LIVES,
      livesRestoredAt: null,
      gems: sql`${users.gems} - ${LIVES_REFILL_GEM_COST}`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ gems: users.gems });

  return { lives: MAX_LIVES, gems: updated.gems };
}
