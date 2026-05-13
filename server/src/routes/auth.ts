import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { validateInitData, upsertUser, getOrCreateDevUser } from '../services/auth-service.js';
import { validateVkLaunchParams, fetchVkUserInfo, upsertVkUser } from '../services/vk-auth-service.js';
import { mergeAccounts } from '../services/account-merge-service.js';

const isDev = process.env.NODE_ENV !== 'production';

export default async function authRoutes(app: FastifyInstance) {
  // ─── Telegram Auth ──────────────────────────────────────────────────────
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
    const token = app.jwt.sign({ id: user.id, platform: 'telegram' as const, platformId: String(user.telegramId) });

    return { token, user: { id: user.id, firstName: user.firstName, username: user.username, level: user.level, xp: user.xp } };
  });

  // ─── VK Auth ────────────────────────────────────────────────────────────
  app.post<{ Body: { launchParams: string } }>('/api/auth/vk-init', async (request, reply) => {
    const { launchParams } = request.body;

    if (!launchParams) {
      return reply.status(400).send({ error: 'launchParams обязателен', code: 'MISSING_LAUNCH_PARAMS' });
    }

    const appSecret = process.env.VK_APP_SECRET;
    if (!appSecret) {
      return reply.status(500).send({ error: 'VK_APP_SECRET не настроен', code: 'SERVER_ERROR' });
    }

    let vkUserId: string;
    try {
      const result = validateVkLaunchParams(launchParams, appSecret);
      vkUserId = result.vkUserId;
    } catch {
      return reply.status(401).send({ error: 'Невалидные данные авторизации VK', code: 'INVALID_VK_DATA' });
    }

    // Получаем данные пользователя через VK API
    const serviceToken = process.env.VK_SERVICE_TOKEN;
    if (!serviceToken) {
      return reply.status(500).send({ error: 'VK_SERVICE_TOKEN не настроен', code: 'SERVER_ERROR' });
    }

    let vkUserData;
    try {
      vkUserData = await fetchVkUserInfo(vkUserId, serviceToken);
    } catch {
      return reply.status(502).send({ error: 'Не удалось получить данные из VK API', code: 'VK_API_ERROR' });
    }

    const user = await upsertVkUser(vkUserData);
    const token = app.jwt.sign({ id: user.id, platform: 'vk' as const, platformId: String(user.vkId) });

    return { token, user: { id: user.id, firstName: user.firstName, username: user.username, level: user.level, xp: user.xp } };
  });

  // ─── Account Link ──────────────────────────────────────────────────────
  app.post<{ Body: { platform: 'telegram' | 'vk'; initData: string } }>(
    '/api/auth/link',
    { onRequest: [app.authenticate] },
    async (request, reply) => {
      const { platform, initData } = request.body;
      const currentUserId = request.user.id;

      if (!platform || !initData) {
        return reply.status(400).send({ error: 'platform и initData обязательны', code: 'MISSING_PARAMS' });
      }

      if (platform === 'telegram') {
        // Привязка Telegram к текущему аккаунту
        const botToken = process.env.BOT_TOKEN;
        if (!botToken) {
          return reply.status(500).send({ error: 'BOT_TOKEN не настроен', code: 'SERVER_ERROR' });
        }

        let tgData;
        try {
          tgData = validateInitData(initData, botToken);
        } catch {
          return reply.status(401).send({ error: 'Невалидные данные Telegram', code: 'INVALID_INIT_DATA' });
        }

        // Проверяем, не занят ли этот telegramId
        const existing = await db.query.users.findFirst({
          where: eq(users.telegramId, tgData.id),
        });

        if (existing && existing.id === currentUserId) {
          return { success: true, message: 'Telegram уже привязан' };
        }

        if (existing) {
          // Merge: переносим данные existing → currentUser, удаляем existing
          await mergeAccounts(currentUserId, existing.id);
        }

        // Привязываем telegramId к текущему пользователю
        await db.update(users)
          .set({
            telegramId: tgData.id,
            username: tgData.username ?? undefined,
            updatedAt: new Date(),
          })
          .where(eq(users.id, currentUserId));

        return { success: true, message: 'Telegram привязан' };
      }

      if (platform === 'vk') {
        // Привязка VK к текущему аккаунту
        const appSecret = process.env.VK_APP_SECRET;
        const serviceToken = process.env.VK_SERVICE_TOKEN;
        if (!appSecret || !serviceToken) {
          return reply.status(500).send({ error: 'VK конфигурация не настроена', code: 'SERVER_ERROR' });
        }

        let vkUserId: string;
        try {
          const result = validateVkLaunchParams(initData, appSecret);
          vkUserId = result.vkUserId;
        } catch {
          return reply.status(401).send({ error: 'Невалидные данные VK', code: 'INVALID_VK_DATA' });
        }

        const vkId = BigInt(vkUserId);

        // Проверяем, не занят ли этот vkId
        const existing = await db.query.users.findFirst({
          where: eq(users.vkId, vkId),
        });

        if (existing && existing.id === currentUserId) {
          return { success: true, message: 'VK уже привязан' };
        }

        if (existing) {
          // Merge
          await mergeAccounts(currentUserId, existing.id);
        }

        // Привязываем vkId к текущему пользователю
        await db.update(users)
          .set({ vkId, updatedAt: new Date() })
          .where(eq(users.id, currentUserId));

        return { success: true, message: 'VK привязан' };
      }

      return reply.status(400).send({ error: 'Неизвестная платформа', code: 'UNKNOWN_PLATFORM' });
    },
  );

  // ─── Dev Auth ───────────────────────────────────────────────────────────
  if (isDev) {
    app.get('/api/auth/dev', async () => {
      const user = await getOrCreateDevUser();
      const token = app.jwt.sign({ id: user.id, platform: 'telegram' as const, platformId: String(user.telegramId) });

      return { token, user: { id: user.id, firstName: user.firstName, username: user.username, level: user.level, xp: user.xp } };
    });
  }
}
