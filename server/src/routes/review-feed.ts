import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { getReviewFeed, getReviewFeedWords } from '../services/review-feed-service.js';

/**
 * GET /api/review-feed/next?limit=N
 *
 * Возвращает массив карточек для режима обзора, отфильтрованный по уровню CEFR
 * текущего пользователя (user.estimatedCefr ± 1).
 *
 * Свайпы пишутся через `POST /api/learning/swipe` (см. routes/learning.ts).
 */
export default async function reviewFeedRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get<{ Querystring: { limit?: string } }>('/api/review-feed/next', async (request) => {
    const userId = request.user.id;
    const limit = request.query.limit ? Number(request.query.limit) : undefined;

    // Берём CEFR пользователя из БД (могло измениться после плейсмента).
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { estimatedCefr: true },
    });

    const cards = await getReviewFeed(userId, { limit, cefr: user?.estimatedCefr ?? null });
    return { cards };
  });

  // Режим A: слова со стопками значений. `exclude` — wordId через запятую,
  // которые клиент уже подгрузил в текущей сессии (бесконечный фид без повторов).
  app.get<{ Querystring: { limit?: string; exclude?: string } }>('/api/review-feed/words', async (request) => {
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

    const words = await getReviewFeedWords(userId, {
      limit,
      cefr: user?.estimatedCefr ?? null,
      excludeWordIds,
    });
    return { words };
  });
}
