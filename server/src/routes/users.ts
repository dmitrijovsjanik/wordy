import type { FastifyInstance } from 'fastify';
import { eq, sql, isNotNull } from 'drizzle-orm';
import { getProfile, getStats, getDailyRewards, updateLanguages, updateSettings, purchaseStreakFreeze, getStreakCalendar } from '../services/user-service.js';
import { isPremium } from '../services/premium-service.js';
import { getLivesStatus, refillLives } from '../services/lives-service.js';
import { VALID_VOICES, DEFAULT_VOICE } from '../config/tts-config.js';
import { XP_BOOST_GEM_COST, XP_BOOST_DURATION_MS } from '../config/xp-boost-config.js';
import { PILOT_FEATURES } from '../config/pilot-config.js';
import { db } from '../db/index.js';
import { wordMeanings, userWordProgressWord, users } from '../db/schema.js';

export default async function userRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/users/me', async (request) => {
    return getProfile(request.user.id);
  });

  app.get('/api/users/me/stats', async (request) => {
    return getStats(request.user.id);
  });

  app.get('/api/users/me/daily-rewards', async (request) => {
    return getDailyRewards(request.user.id);
  });

  app.put<{
    Body: { nativeLanguage: string; learningLanguage: string };
  }>('/api/users/me/languages', async (request) => {
    const { nativeLanguage, learningLanguage } = request.body;
    return updateLanguages(request.user.id, nativeLanguage, learningLanguage);
  });

  app.patch<{
    Body: { repeatMastered?: boolean; ttsVoice?: string };
  }>('/api/users/me/settings', async (request, reply) => {
    const { ttsVoice } = request.body;

    if (ttsVoice !== undefined) {
      if (!VALID_VOICES.includes(ttsVoice as typeof VALID_VOICES[number])) {
        return reply.code(400).send({ error: 'Неизвестный голос', code: 'INVALID_VOICE' });
      }
      if (ttsVoice !== DEFAULT_VOICE && PILOT_FEATURES.payments) {
        const premium = await isPremium(request.user.id);
        if (!premium) {
          return reply.code(403).send({ error: 'Необходима подписка PRO', code: 'PREMIUM_REQUIRED' });
        }
      }
    }

    return updateSettings(request.user.id, request.body);
  });

  app.get<{
    Querystring: { months?: string };
  }>('/api/users/me/streak-calendar', async (request) => {
    const months = Math.min(Math.max(Number(request.query.months) || 3, 1), 12);
    return getStreakCalendar(request.user.id, months);
  });

  app.post<{
    Body: { days: number };
  }>('/api/users/me/streak-freeze/purchase', async (request, reply) => {
    if (!PILOT_FEATURES.gems) {
      return reply.code(403).send({ error: 'Магазин недоступен', code: 'GEMS_DISABLED' });
    }

    const { days } = request.body;
    if (!days || typeof days !== 'number') {
      return reply.code(400).send({ error: 'Укажите количество дней', code: 'INVALID_PACK' });
    }

    try {
      const result = await purchaseStreakFreeze(request.user.id, days);
      return { success: true, gems: result.gems, streakFreezes: result.streakFreezes };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      if (message === 'INVALID_PACK') {
        return reply.code(400).send({ error: 'Недопустимый пак', code: 'INVALID_PACK' });
      }
      if (message === 'INSUFFICIENT_GEMS') {
        return reply.code(400).send({ error: 'Недостаточно кристаллов', code: 'INSUFFICIENT_GEMS' });
      }
      if (message === 'MAX_FREEZES_REACHED') {
        return reply.code(400).send({ error: 'Достигнут лимит заморозок', code: 'MAX_FREEZES_REACHED' });
      }
      throw error;
    }
  });

  // ─── Lives ─────────────────────────────────────────────────────────────────

  app.get('/api/users/me/lives', async (request) => {
    return getLivesStatus(request.user.id);
  });

  app.post('/api/users/me/lives/refill', async (request, reply) => {
    if (!PILOT_FEATURES.gems) {
      return reply.code(403).send({ error: 'Магазин недоступен', code: 'GEMS_DISABLED' });
    }

    try {
      const result = await refillLives(request.user.id);
      return { success: true, lives: result.lives, gems: result.gems };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      if (message === 'INSUFFICIENT_GEMS') {
        return reply.code(400).send({ error: 'Недостаточно кристаллов', code: 'INSUFFICIENT_GEMS' });
      }
      throw error;
    }
  });

  // ─── XP Boost ─────────────────────────────────────────────────────────────

  app.post('/api/users/me/xp-boost/purchase', async (request, reply) => {
    if (!PILOT_FEATURES.gems) {
      return reply.code(403).send({ error: 'Магазин недоступен', code: 'GEMS_DISABLED' });
    }

    const userId = request.user.id;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { gems: true, xpBoostUntil: true },
    });

    if (!user) return reply.code(404).send({ error: 'Пользователь не найден' });

    if (user.gems < XP_BOOST_GEM_COST) {
      return reply.code(400).send({ error: 'Недостаточно кристаллов', code: 'INSUFFICIENT_GEMS' });
    }

    const now = new Date();
    // Продлеваем если буст активен, иначе от текущего времени
    const baseDate = user.xpBoostUntil && user.xpBoostUntil > now
      ? user.xpBoostUntil
      : now;
    const newBoostUntil = new Date(baseDate.getTime() + XP_BOOST_DURATION_MS);

    await db
      .update(users)
      .set({
        gems: sql`${users.gems} - ${XP_BOOST_GEM_COST}`,
        xpBoostUntil: newBoostUntil,
        updatedAt: now,
      })
      .where(eq(users.id, userId));

    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { gems: true },
    });

    return {
      success: true,
      until: newBoostUntil.toISOString(),
      gems: updatedUser?.gems ?? 0,
    };
  });

  // ─── CEFR Progress ───────────────────────────────────────────────────────

  app.get('/api/users/me/cefr-progress', async (request) => {
    const userId = request.user.id;

    // CEFR-прогресс: считаем слова, где tier ∈ {review, mastered} в учёте word-level.
    // wordMeanings.cefr берём для отображения распределения по уровням.
    const rows = await db
      .select({
        cefrLevel: wordMeanings.cefr,
        totalWords: sql<number>`COUNT(DISTINCT ${wordMeanings.id})`.as('total_words'),
        learnedWords: sql<number>`COUNT(DISTINCT CASE WHEN ${userWordProgressWord.learningTier} IN ('review', 'mastered') THEN ${wordMeanings.id} END)`.as('learned_words'),
      })
      .from(wordMeanings)
      .leftJoin(
        userWordProgressWord,
        sql`${userWordProgressWord.wordId} = ${wordMeanings.wordId} AND ${userWordProgressWord.userId} = ${userId}`,
      )
      .where(isNotNull(wordMeanings.cefr))
      .groupBy(wordMeanings.cefr)
      .orderBy(
        sql`CASE ${wordMeanings.cefr}
          WHEN 'a1' THEN 1 WHEN 'a2' THEN 2 WHEN 'b1' THEN 3
          WHEN 'b2' THEN 4 WHEN 'c1' THEN 5 ELSE 6 END`,
      );

    const levels = rows.map((row) => {
      const total = Number(row.totalWords);
      const learned = Number(row.learnedWords);
      return {
        level: row.cefrLevel as string,
        totalWords: total,
        learnedWords: learned,
        percent: total > 0 ? Math.round((learned / total) * 100) : 0,
      };
    });

    return { levels };
  });
}
