import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { isAdmin } from '../config/admin-config.js';
import * as adminService from '../services/admin-service.js';

/**
 * Проверка hash от Telegram Login Widget.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
function verifyTelegramLogin(data: Record<string, string>, botToken: string): boolean {
  const { hash, ...rest } = data;
  if (!hash) return false;

  const checkString = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');

  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

  return hmac === hash;
}

export default async function adminRoutes(app: FastifyInstance) {
  // ─── Public: bot config for login page ────────────────────────────────
  app.get('/api/admin/auth/config', async (_request, reply) => {
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return reply.status(500).send({ error: 'BOT_TOKEN не настроен' });
    }
    const botId = botToken.split(':')[0];
    return { botId };
  });

  // ─── Auth: Telegram Login Widget ────────────────────────────────────────
  app.post<{ Body: Record<string, string> }>(
    '/api/admin/auth/telegram',
    async (request, reply) => {
      const data = request.body;

      const botToken = process.env.BOT_TOKEN;
      if (!botToken) {
        return reply.status(500).send({ error: 'BOT_TOKEN не настроен', code: 'SERVER_ERROR' });
      }

      if (!verifyTelegramLogin(data, botToken)) {
        return reply.status(401).send({ error: 'Невалидные данные Telegram', code: 'INVALID_TELEGRAM_DATA' });
      }

      // Проверка давности авторизации (не старше 24 часов)
      const authDate = Number(data.auth_date);
      if (Date.now() / 1000 - authDate > 86400) {
        return reply.status(401).send({ error: 'Данные авторизации устарели', code: 'AUTH_EXPIRED' });
      }

      const telegramId = data.id;
      if (!isAdmin('telegram', telegramId)) {
        return reply.status(403).send({ error: 'Нет доступа к админ-панели', code: 'NOT_ADMIN' });
      }

      const token = app.jwt.sign(
        { id: 0, role: 'admin', platform: 'telegram' as const, platformId: telegramId },
        { expiresIn: '7d' },
      );

      return {
        token,
        admin: {
          telegramId,
          firstName: data.first_name ?? 'Admin',
          username: data.username,
          photoUrl: data.photo_url,
        },
      };
    },
  );

  // ─── Protected Admin Routes ─────────────────────────────────────────────
  app.register(async (protectedApp) => {
    protectedApp.addHook('onRequest', protectedApp.authenticateAdmin);

    // Dashboard: General Stats
    protectedApp.get('/api/admin/stats/general', async () => {
      return adminService.getGeneralStats();
    });

    // Dashboard: Activity
    protectedApp.get<{ Querystring: { days?: string } }>(
      '/api/admin/stats/activity',
      async (request) => {
        const days = Math.min(Math.max(Number(request.query.days) || 30, 7), 90);
        return adminService.getActivityStats(days);
      },
    );

    // Dashboard: Economy
    protectedApp.get('/api/admin/stats/economy', async () => {
      return adminService.getEconomyStats();
    });

    // Dashboard: SRS
    protectedApp.get('/api/admin/stats/srs', async () => {
      return adminService.getSrsStats();
    });

    // Users List
    protectedApp.get<{
      Querystring: { page?: string; limit?: string; search?: string; sort?: string; order?: string };
    }>('/api/admin/users', async (request) => {
      const page = Math.max(Number(request.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(request.query.limit) || 50, 10), 100);
      const search = request.query.search || undefined;
      const sort = request.query.sort || 'createdAt';
      const order = request.query.order === 'asc' ? 'asc' : 'desc';
      return adminService.getUsersList({ page, limit, search, sort, order });
    });

    // User Detail
    protectedApp.get<{ Params: { id: string } }>(
      '/api/admin/users/:id',
      async (request, reply) => {
        const id = Number(request.params.id);
        try {
          return await adminService.getUserDetail(id);
        } catch (err) {
          return reply.status(404).send({ error: (err as Error).message });
        }
      },
    );

    // User Activity History
    protectedApp.get<{ Params: { id: string }; Querystring: { limit?: string } }>(
      '/api/admin/users/:id/activity',
      async (request) => {
        const id = Number(request.params.id);
        const limit = Math.min(Math.max(Number(request.query.limit) || 50, 10), 200);
        return adminService.getUserActivity(id, limit);
      },
    );

    // User Word Progress
    protectedApp.get<{ Params: { id: string } }>(
      '/api/admin/users/:id/words',
      async (request) => {
        const id = Number(request.params.id);
        return adminService.getUserWordProgress(id);
      },
    );

    // Give Gems
    protectedApp.post<{ Params: { id: string }; Body: { amount: number; reason: string } }>(
      '/api/admin/users/:id/give-gems',
      async (request, reply) => {
        const id = Number(request.params.id);
        const { amount, reason } = request.body;
        if (!amount || typeof amount !== 'number' || amount <= 0) {
          return reply.status(400).send({ error: 'Некорректная сумма', code: 'INVALID_AMOUNT' });
        }
        return adminService.giveGems(id, amount, reason ?? '');
      },
    );
  });
}
