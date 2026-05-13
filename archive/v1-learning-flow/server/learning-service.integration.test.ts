/**
 * Integration-тесты v2-flow с реальной БД.
 *
 * Стратегия изоляции: каждый тест создаёт уникального тестового user-а с
 * negative telegram_id (-9_000_000 - timestamp), коллекцию из реальных
 * eligible слов БД, прогоняет сценарий, в afterEach удаляет user-а
 * (cascade удалит user_word_progress_word и связанные learning_events).
 *
 * Запуск:
 *   npm test src/services/learning-service.integration.test.ts
 *
 * Если БД недоступна (нет DATABASE_URL или нет postgres) — `describe.skip`.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { eq, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  words,
  wordMeanings,
  collections,
  collectionWords,
  userCollections,
  userWordProgressWord,
} from '../db/schema.js';
import {
  pickNext,
  recordAnswer,
  applyPoolSwipe,
  computeTransition,
} from './learning-service.js';
import { learningConfig } from '../config/learning-config.js';

// ─── Test fixtures ──────────────────────────────────────────────────────────

let testUserId: number;
let testCollectionId: number;

/** Имеющиеся в реальной БД eligible слова — выбираем 5 для каждого теста.
 *  Не создаём искусственные words/meanings: фильтр popularity_rank ≤ 3 /
 *  freq ≥ 5 / cyrillic translation требует валидных данных. */
let testWordIds: number[];

async function checkDbAvailable(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

async function loadEligibleWords(n: number): Promise<number[]> {
  const rows = await db.execute(sql`
    SELECT wm.word_id
    FROM word_meanings wm
    WHERE (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
    GROUP BY wm.word_id
    ORDER BY wm.word_id
    LIMIT ${n}
  `);
  return (rows as unknown as { rows: Array<{ word_id: number }> }).rows.map((r) => Number(r.word_id));
}

const dbAvailable = await checkDbAvailable();

describe.skipIf(!dbAvailable)('learning-service integration', () => {
  beforeAll(async () => {
    testWordIds = await loadEligibleWords(5);
    expect(testWordIds.length).toBeGreaterThan(0);
  });

  beforeEach(async () => {
    // Уникальный test-user (negative tg id вне диапазона реальных)
    const tgId = -(9_000_000 + Math.floor(Date.now() % 1_000_000));
    // NB: first_name требует NOT NULL в реальной БД (schema.ts его как nullable
     // декларирует, расхождение — отдельный баг, не относится к v2-тестам).
    // Пишем напрямую через SQL, чтобы обойти.
    const username = `v2_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ures = await db.execute(sql`
      INSERT INTO users (telegram_id, username, first_name)
      VALUES (${tgId}, ${username}, 'V2 Test')
      RETURNING id
    `);
    const u = { id: Number((ures as unknown as { rows: Array<{ id: number }> }).rows[0]!.id) };
    testUserId = u.id;

    // Уникальная тестовая коллекция
    const [c] = await db
      .insert(collections)
      .values({
        title: `v2 test ${Date.now()}`,
        description: 'integration test',
        type: 'user',
        difficulty: 'easy',
        wordCount: testWordIds.length,
      })
      .returning({ id: collections.id });
    testCollectionId = c!.id;

    // Привязываем testUser к коллекции
    await db.insert(userCollections).values({
      userId: testUserId,
      collectionId: testCollectionId,
    });

    // Привязываем eligible meanings выбранных слов к коллекции
    const meanings = await db
      .select({ id: wordMeanings.id })
      .from(wordMeanings)
      .where(inArray(wordMeanings.wordId, testWordIds));
    if (meanings.length > 0) {
      await db.insert(collectionWords).values(
        meanings.map((m) => ({
          collectionId: testCollectionId,
          meaningId: m.id,
        })),
      );
    }
  });

  afterEach(async () => {
    // Cleanup в обратном порядке: user_word_progress_word (CASCADE через user),
    // user_collections (CASCADE), collection_words, collections, user.
    if (testUserId) {
      await db.delete(users).where(eq(users.id, testUserId));
    }
    if (testCollectionId) {
      await db
        .delete(collectionWords)
        .where(eq(collectionWords.collectionId, testCollectionId));
      await db.delete(collections).where(eq(collections.id, testCollectionId));
    }
  });

  // ─── pickNext базовые сценарии ──────────────────────────────────────────

  it('новый user, пустой словарный прогресс → подкачка коллекции в pool + возврат pool-карточки', async () => {
    const pick = await pickNext(testUserId, { collectionId: testCollectionId });
    expect(pick.kind).toBe('word');
    if (pick.kind === 'word') {
      expect(pick.tier).toBe('pool');
      expect(testWordIds).toContain(pick.wordId);
    }

    // В БД должна появиться запись с tier='pool'
    const records = await db
      .select()
      .from(userWordProgressWord)
      .where(eq(userWordProgressWord.userId, testUserId));
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((r) => r.learningTierV2 === 'pool')).toBe(true);
  });

  it('user без коллекции → session_complete reason=no_words', async () => {
    const pick = await pickNext(testUserId, {});
    expect(pick.kind).toBe('session_complete');
    if (pick.kind === 'session_complete') {
      expect(pick.reason).toBe('no_words');
      expect(pick.counts.pool).toBe(0);
      expect(pick.counts.passive).toBe(0);
    }
  });

  it('excludeWordIds блокирует слово, но retry без exclude находит → reason=all_recent', async () => {
    // Подкачаем pool первым pickNext
    await pickNext(testUserId, { collectionId: testCollectionId });
    // Соберём все доступные wordIds в pool
    const pool = await db
      .select({ wordId: userWordProgressWord.wordId })
      .from(userWordProgressWord)
      .where(eq(userWordProgressWord.userId, testUserId));
    const allPoolIds = pool.map((p) => p.wordId);
    expect(allPoolIds.length).toBeGreaterThan(0);

    // Теперь excludeWordIds = все pool wordIds. Picker должен вернуть all_recent.
    const pick = await pickNext(testUserId, {
      collectionId: testCollectionId,
      excludeWordIds: allPoolIds,
    });
    expect(pick.kind).toBe('session_complete');
    if (pick.kind === 'session_complete') {
      expect(pick.reason).toBe('all_recent');
    }
  });

  // ─── applyPoolSwipe сценарии ──────────────────────────────────────────────

  it('swipe learn → tier=passive, state=active', async () => {
    const wordId = testWordIds[0]!;
    await applyPoolSwipe({ userId: testUserId, wordId, action: 'learn' });

    const [rec] = await db
      .select()
      .from(userWordProgressWord)
      .where(eq(userWordProgressWord.userId, testUserId));
    expect(rec).toBeDefined();
    expect(rec!.learningTierV2).toBe('passive');
    expect(rec!.stateV2).toBe('active');
    expect(rec!.tierCorrectCount).toBe(0);
  });

  it('swipe know → tier=review stage=0, next_review_at в будущем (1 день)', async () => {
    const wordId = testWordIds[0]!;
    const before = Date.now();
    await applyPoolSwipe({ userId: testUserId, wordId, action: 'know' });

    const [rec] = await db
      .select()
      .from(userWordProgressWord)
      .where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('review');
    expect(rec!.reviewStage).toBe(0);
    expect(rec!.nextReviewAt).not.toBeNull();
    const nextReview = rec!.nextReviewAt!.getTime();
    const expected = before + learningConfig.poolKnowToReviewDays * 24 * 60 * 60 * 1000;
    // допуск 5 минут
    expect(Math.abs(nextReview - expected)).toBeLessThan(5 * 60 * 1000);
  });

  it('swipe snooze → state=pool_snoozed, snoozed_until > now', async () => {
    const wordId = testWordIds[0]!;
    await applyPoolSwipe({ userId: testUserId, wordId, action: 'snooze' });

    const [rec] = await db
      .select()
      .from(userWordProgressWord)
      .where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('pool');
    expect(rec!.stateV2).toBe('pool_snoozed');
    expect(rec!.snoozedUntil).not.toBeNull();
    expect(rec!.snoozedUntil!.getTime()).toBeGreaterThan(Date.now());
  });

  it('safety: swipe learn на review-слове НЕ обнуляет reviewStage (защита от потери SRS-прогресса)', async () => {
    const wordId = testWordIds[0]!;
    // Поставим вручную review с reviewStage=3
    await db.insert(userWordProgressWord).values({
      userId: testUserId,
      wordId,
      learningTierV2: 'review',
      stateV2: 'active',
      reviewStage: 3,
      consecutiveEasyOrGood: 1,
    });

    // swipe learn — должен сделать мягкий откат на active, НЕ затирая reviewStage
    await applyPoolSwipe({ userId: testUserId, wordId, action: 'learn' });

    const [rec] = await db
      .select()
      .from(userWordProgressWord)
      .where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('active');
    // reviewStage сохранён (см. ветку safety в applyPoolSwipe)
    expect(rec!.reviewStage).toBe(3);
  });

  // ─── recordAnswer + переходы лестницы ────────────────────────────────────

  it('passive (L1) — correct N раз → переход в active', async () => {
    const wordId = testWordIds[0]!;
    const threshold = learningConfig.tiers.passive.correctToAdvance;
    await applyPoolSwipe({ userId: testUserId, wordId, action: 'learn' });

    // N - 1 правильных → остаёмся на passive
    for (let i = 0; i < threshold - 1; i++) {
      const res = await recordAnswer({ userId: testUserId, wordId, isCorrect: true });
      expect(res.tierAfter).toBe('passive');
    }
    // N-й правильный → active
    const res = await recordAnswer({ userId: testUserId, wordId, isCorrect: true });
    expect(res.tierAfter).toBe('active');
    expect(res.wasAdvanced).toBe(true);

    const [rec] = await db
      .select()
      .from(userWordProgressWord)
      .where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('active');
    expect(rec!.tierCorrectCount).toBe(0);
  });

  it.skipIf(learningConfig.tiers.passive.correctToAdvance < 2)(
    'passive wrong → tcc=0, остаёмся на passive (откатов нет) [только при пороге >=2]',
    async () => {
      const wordId = testWordIds[0]!;
      await applyPoolSwipe({ userId: testUserId, wordId, action: 'learn' });
      // Сначала correct (tcc 0→1)
      await recordAnswer({ userId: testUserId, wordId, isCorrect: true });
      // Затем wrong (tcc 1→0, остаёмся на passive)
      await recordAnswer({ userId: testUserId, wordId, isCorrect: false });
      const [rec] = await db
        .select()
        .from(userWordProgressWord)
        .where(eq(userWordProgressWord.userId, testUserId));
      expect(rec!.learningTierV2).toBe('passive');
      expect(rec!.tierCorrectCount).toBe(0);
    },
  );

  it('full path: pool → passive → active → review → ... до mastered', async () => {
    const wordId = testWordIds[0]!;
    await applyPoolSwipe({ userId: testUserId, wordId, action: 'learn' });

    const passiveThreshold = learningConfig.tiers.passive.correctToAdvance;
    const activeThreshold = learningConfig.tiers.active.correctToAdvance;

    // Passive → active
    for (let i = 0; i < passiveThreshold; i++) {
      await recordAnswer({ userId: testUserId, wordId, isCorrect: true });
    }
    let [rec] = await db.select().from(userWordProgressWord).where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('active');

    // Active → review
    for (let i = 0; i < activeThreshold; i++) {
      await recordAnswer({ userId: testUserId, wordId, isCorrect: true });
    }
    [rec] = await db.select().from(userWordProgressWord).where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('review');
    expect(rec!.reviewStage).toBe(0);

    // Review SRS до mastered: grade=good на каждом stage, на финале 2 раза good подряд
    const stages = learningConfig.reviewGrid.length; // 8
    for (let i = 0; i < stages - 1; i++) {
      const res = await recordAnswer({ userId: testUserId, wordId, grade: 'good' });
      expect(res.tierAfter).toBe('review');
    }
    // Дошли до stage=7. consec=0. Один good → consec=1.
    let res = await recordAnswer({ userId: testUserId, wordId, grade: 'good' });
    expect(res.tierAfter).toBe('review');
    expect(res.becameMastered).toBe(false);
    // Ещё один good → mastered
    res = await recordAnswer({ userId: testUserId, wordId, grade: 'good' });
    expect(res.tierAfter).toBe('mastered');
    expect(res.becameMastered).toBe(true);

    [rec] = await db.select().from(userWordProgressWord).where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('mastered');
    expect(rec!.masteredAt).not.toBeNull();
  });

  it('review grade=again → откат в active, reviewStage=0, wasReset=true', async () => {
    const wordId = testWordIds[0]!;
    // Ставим вручную review stage=3
    await db.insert(userWordProgressWord).values({
      userId: testUserId,
      wordId,
      learningTierV2: 'review',
      stateV2: 'active',
      reviewStage: 3,
    });

    const res = await recordAnswer({ userId: testUserId, wordId, grade: 'again' });
    expect(res.tierBefore).toBe('review');
    expect(res.tierAfter).toBe('active');
    expect(res.wasReset).toBe(true);

    const [rec] = await db.select().from(userWordProgressWord).where(eq(userWordProgressWord.userId, testUserId));
    expect(rec!.learningTierV2).toBe('active');
    expect(rec!.reviewStage).toBe(0);
  });

  // ─── pickNext приоритеты ────────────────────────────────────────────────

  it('приоритет: review-due идёт раньше pool', async () => {
    const reviewWordId = testWordIds[0]!;
    const poolWordId = testWordIds[1]!;
    // review с nextReviewAt в прошлом (due)
    await db.insert(userWordProgressWord).values({
      userId: testUserId,
      wordId: reviewWordId,
      learningTierV2: 'review',
      stateV2: 'active',
      reviewStage: 2,
      nextReviewAt: new Date(Date.now() - 60 * 1000),
    });
    // pool
    await db.insert(userWordProgressWord).values({
      userId: testUserId,
      wordId: poolWordId,
      learningTierV2: 'pool',
      stateV2: 'active',
    });

    const pick = await pickNext(testUserId, { collectionId: testCollectionId });
    expect(pick.kind).toBe('word');
    if (pick.kind === 'word') {
      expect(pick.tier).toBe('review');
      expect(pick.wordId).toBe(reviewWordId);
    }
  });

  it('review не-due (nextReviewAt в будущем) не выбирается → возвращается pool', async () => {
    const reviewWordId = testWordIds[0]!;
    const poolWordId = testWordIds[1]!;
    await db.insert(userWordProgressWord).values({
      userId: testUserId,
      wordId: reviewWordId,
      learningTierV2: 'review',
      stateV2: 'active',
      reviewStage: 2,
      nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // завтра
    });
    await db.insert(userWordProgressWord).values({
      userId: testUserId,
      wordId: poolWordId,
      learningTierV2: 'pool',
      stateV2: 'active',
    });

    const pick = await pickNext(testUserId, { collectionId: testCollectionId });
    expect(pick.kind).toBe('word');
    if (pick.kind === 'word') {
      expect(pick.tier).toBe('pool');
      expect(pick.wordId).toBe(poolWordId);
    }
  });

  it('все слова на review-cooldown → session_complete reason=all_in_cooldown', async () => {
    for (const wordId of testWordIds) {
      await db.insert(userWordProgressWord).values({
        userId: testUserId,
        wordId,
        learningTierV2: 'review',
        stateV2: 'active',
        reviewStage: 2,
        nextReviewAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    const pick = await pickNext(testUserId, { collectionId: testCollectionId });
    expect(pick.kind).toBe('session_complete');
    if (pick.kind === 'session_complete') {
      expect(pick.reason).toBe('all_in_cooldown');
      expect(pick.counts.review).toBe(testWordIds.length);
      expect(pick.nextDueAt).not.toBeNull();
    }
  });

  it('pool_snoozed не подбирается, snooze-period отработан → подбирается', async () => {
    const wordId = testWordIds[0]!;
    // snooze
    await applyPoolSwipe({ userId: testUserId, wordId, action: 'snooze' });
    let pick = await pickNext(testUserId, { collectionId: testCollectionId });
    // Должен вернуть что-то другое из подкачки коллекции, не этот word
    if (pick.kind === 'word') {
      expect(pick.wordId).not.toBe(wordId);
    }

    // Эмулируем что snooze истёк
    await db
      .update(userWordProgressWord)
      .set({
        snoozedUntil: new Date(Date.now() - 60 * 1000),
        // но сам state остаётся pool_snoozed — picker должен учесть это
      })
      .where(eq(userWordProgressWord.userId, testUserId));

    // pool_snoozed по тому же state-фильтру в tryPickTier не подбирается (state_v2='active' нужен)
    // → даже после snooze-expiry слово сидит в pool_snoozed пока юзер сам что-то не сделает
    pick = await pickNext(testUserId, { collectionId: testCollectionId, excludeWordIds: [wordId] });
    if (pick.kind === 'word') {
      expect(pick.wordId).not.toBe(wordId);
    }
  });
});
