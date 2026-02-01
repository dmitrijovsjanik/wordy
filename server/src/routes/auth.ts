import type { FastifyInstance } from 'fastify';
import { validateInitData, upsertUser, getOrCreateDevUser } from '../services/auth-service.js';

const isDev = process.env.NODE_ENV !== 'production';

export default async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { initData: string } }>('/api/auth/init', async (request, reply) => {
    const { initData } = request.body;

    if (!initData) {
      return reply.status(400).send({ error: 'initData обязателен', code: 'MISSING_INIT_DATA' });
    }

    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return reply.status(500).send({ error: 'BOT_TOKEN не настроен', code: 'SERVER_ERROR' });
    }

    let userData;
    try {
      userData = validateInitData(initData, botToken);
    } catch {
      return reply.status(401).send({ error: 'Невалидные данные авторизации', code: 'INVALID_INIT_DATA' });
    }

    const user = await upsertUser(userData);
    const token = app.jwt.sign({ id: user.id, telegramId: String(user.telegramId) });

    return { token, user: { id: user.id, firstName: user.firstName, username: user.username, level: user.level, xp: user.xp } };
  });

  if (isDev) {
    app.get('/api/auth/dev', async () => {
      const user = await getOrCreateDevUser();
      const token = app.jwt.sign({ id: user.id, telegramId: String(user.telegramId) });

      return { token, user: { id: user.id, firstName: user.firstName, username: user.username, level: user.level, xp: user.xp } };
    });
  }
}
