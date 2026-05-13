import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { getReviewFeedNext } from '../services/review-feed-service.js';

/**
 * GET /api/review-feed/next?limit=N&exclude=wordId,wordId,...
 *
 * Возвращает следующую порцию слов для обзора. Один режим: карточка =
 * слово + все его eligible meanings. CEFR-фильтр по user.estimatedCefr ± 1.
 *
 * `exclude` — wordId через запятую, которые клиент уже подгрузил (бесконечный
 * фид без повторов). Свайпы пишутся через POST /api/learning/swipe.
 */
export default async function reviewFeedRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get<{ Querystring: { limit?: string; exclude?: string } }>('/api/review-feed/next', async (request) => {
    const userId = request.user.id;
    const limit = request.query.limit ? Number(request.query.limit) : undefined;
    const excludeStr = request.query.exclude ?? '';
    const excludeWordIds = excludeStr
      ? excludeStr.split(',').map(Number).filter(n => !Number.isNaN(n))
      : [];

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { estimatedCefr: true },
    });

    const words = await getReviewFeedNext(userId, {
      limit,
      cefr: user?.estimatedCefr ?? null,
      excludeWordIds,
    });
    return { words };
  });
}
