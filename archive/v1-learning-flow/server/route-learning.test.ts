/**
 * Тесты /api/learning/* через fastify.inject. Без живого порта.
 * Использует реальную БД — создаём изолированного user-а и коллекцию.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { sql, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  wordMeanings,
  collections,
  collectionWords,
  userCollections,
  userWordProgressWord,
} from '../db/schema.js';
import authPlugin from '../middleware/auth.js';
import learningRoutes from './learning.js';

async function checkDb(): Promise<boolean> {
  try { await db.execute(sql`SELECT 1`); return true; } catch { return false; }
}
const dbAvailable = await checkDb();

let app: FastifyInstance;
let testUserId: number;
let testCollectionId: number;
let token: string;
let testWordIds: number[] = [];

describe.skipIf(!dbAvailable)('learning v2 routes', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    app = Fastify({ logger: false });
    await app.register(authPlugin);
    await app.register(learningRoutes);
    await app.ready();

    // Берём 3 eligible слова
    const rows = await db.execute(sql`
      SELECT wm.word_id FROM word_meanings wm
      WHERE (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
        AND (wm.frequency IS NULL OR wm.frequency >= 5)
        AND wm.translation ~ '[а-яА-ЯёЁ]'
      GROUP BY wm.word_id LIMIT 3
    `);
    testWordIds = (rows as unknown as { rows: Array<{ word_id: number }> }).rows.map((r) => Number(r.word_id));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    const tgId = -(8_000_000 + Math.floor(Date.now() % 1_000_000));
    const ures = await db.execute(sql`
      INSERT INTO users (telegram_id, username, first_name)
      VALUES (${tgId}, ${'rt_test_' + Date.now()}, 'RT Test')
      RETURNING id
    `);
    testUserId = Number((ures as unknown as { rows: Array<{ id: number }> }).rows[0]!.id);
    token = app.jwt.sign({ id: testUserId });

    const [c] = await db
      .insert(collections)
      .values({
        title: `rt test ${Date.now()}`,
        description: 't',
        type: 'user',
        difficulty: 'easy',
        wordCount: testWordIds.length,
      })
      .returning({ id: collections.id });
    testCollectionId = c!.id;
    await db.insert(userCollections).values({ userId: testUserId, collectionId: testCollectionId });

    const ms = await db
      .select({ id: wordMeanings.id })
      .from(wordMeanings)
      .where(inArray(wordMeanings.wordId, testWordIds));
    if (ms.length > 0) {
      await db.insert(collectionWords).values(
        ms.map((m) => ({ collectionId: testCollectionId, meaningId: m.id })),
      );
    }
  });

  afterEach(async () => {
    if (testUserId) await db.delete(users).where(eq(users.id, testUserId));
    if (testCollectionId) {
      await db.delete(collectionWords).where(eq(collectionWords.collectionId, testCollectionId));
      await db.delete(collections).where(eq(collections.id, testCollectionId));
    }
  });

  function authHeader(): { authorization: string } {
    return { authorization: `Bearer ${token}` };
  }

  // ─── /v2/next ──────────────────────────────────────────────────────────

  it('GET /v2/next без токена → 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/learning/next' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /v2/next с collectionId → возвращает question + tier=pool (подкачка)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/learning/next?collectionId=${testCollectionId}`,
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.tier).toBe('pool');
    expect(body.question.type).toBe('pool-card');
  });

  it('GET /v2/next без collectionId → session_complete reason=no_words', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/learning/next',
      headers: authHeader(),
    });
    const body = JSON.parse(res.body);
    expect(body.mode).toBe('session_complete');
    expect(body.reason).toBe('no_words');
  });

  it('GET /v2/next с excludeWordIds=пусто → не падает', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/learning/next?collectionId=${testCollectionId}&excludeWordIds=`,
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
  });

  it('GET /v2/next с excludeWordIds = все wordIds → session_complete all_recent', async () => {
    // Подкачаем pool через первый next
    await app.inject({
      method: 'GET',
      url: `/api/learning/next?collectionId=${testCollectionId}`,
      headers: authHeader(),
    });
    const exclude = testWordIds.join(',');
    const res = await app.inject({
      method: 'GET',
      url: `/api/learning/next?collectionId=${testCollectionId}&excludeWordIds=${exclude}`,
      headers: authHeader(),
    });
    const body = JSON.parse(res.body);
    expect(body.mode).toBe('session_complete');
    expect(body.reason).toBe('all_recent');
  });

  // ─── /v2/answer ────────────────────────────────────────────────────────

  it('POST /v2/answer без wordId → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/learning/answer',
      headers: authHeader(),
      payload: { isCorrect: true },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /v2/answer на passive: возвращает tierBefore/tierAfter/xp', async () => {
    // Через swipe ставим слово в passive
    await app.inject({
      method: 'POST',
      url: '/api/learning/swipe',
      headers: authHeader(),
      payload: { wordId: testWordIds[0], action: 'learn' },
    });
    const res = await app.inject({
      method: 'POST',
      url: '/api/learning/answer',
      headers: authHeader(),
      payload: { wordId: testWordIds[0], isCorrect: true, questionType: 'passive-recall' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      isCorrect: true,
      tierBefore: 'passive',
      xpEarned: expect.any(Number),
    });
  });

  it('POST /v2/answer userAnswer + acceptableAnswers → нормализатор переопределяет isCorrect', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/learning/swipe',
      headers: authHeader(),
      payload: { wordId: testWordIds[0], action: 'learn' },
    });
    // Клиент шлёт isCorrect=false, но userAnswer совпадает
    const res = await app.inject({
      method: 'POST',
      url: '/api/learning/answer',
      headers: authHeader(),
      payload: {
        wordId: testWordIds[0],
        isCorrect: false,
        userAnswer: 'whatever',
        acceptableAnswers: ['whatever'],
        partOfSpeech: 'noun',
      },
    });
    const body = JSON.parse(res.body);
    // Сервер сам перевалидировал — должен исправить isCorrect=true и via='exact'
    expect(body.isCorrect).toBe(true);
    expect(body.normalizedVia).toBe('exact');
  });

  // ─── /v2/swipe ─────────────────────────────────────────────────────────

  it('POST /v2/swipe action=learn → 200 ok, в БД tier_v2=passive', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/learning/swipe',
      headers: authHeader(),
      payload: { wordId: testWordIds[0], action: 'learn' },
    });
    expect(res.statusCode).toBe(200);
    const [rec] = await db.select().from(userWordProgressWord).where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('passive');
  });

  it('POST /v2/swipe без wordId → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/learning/swipe',
      headers: authHeader(),
      payload: { action: 'learn' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('POST /v2/swipe с невалидным action → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/learning/swipe',
      headers: authHeader(),
      payload: { wordId: testWordIds[0], action: 'invalid' },
    });
    expect(res.statusCode).toBe(400);
  });

  // ─── Edge: excludeWordIds=0 не должен ломать выборку ───────────────────

  it('excludeWordIds=0 (пустая строка приходит как [0]) — фикс работает: не блокирует валидные слова', async () => {
    // Симуляция бага: пустой query.excludeWordIds через split(',') → [''] → Number('') → 0
    // После фикса должен фильтровать пустые строки до Number().
    const res = await app.inject({
      method: 'GET',
      url: `/api/learning/next?collectionId=${testCollectionId}&excludeWordIds=`,
      headers: authHeader(),
    });
    const body = JSON.parse(res.body);
    expect(body.tier).toBe('pool');
    expect(body.question).toBeDefined();
  });
});
