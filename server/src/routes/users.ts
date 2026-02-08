import type { FastifyInstance } from 'fastify';
import { getProfile, getStats, getDailyRewards, updateLanguages, updateSettings, purchaseStreakFreeze, getStreakCalendar } from '../services/user-service.js';

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
    Body: { repeatMastered?: boolean };
  }>('/api/users/me/settings', async (request) => {
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
}
