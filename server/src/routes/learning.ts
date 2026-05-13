import type { FastifyInstance } from 'fastify';
import { recordEvent } from '../services/analytics-service.js';
import {
  rewardCorrectAnswer,
  updateStreakDays,
  XP_CORRECT_ANSWER,
} from '../services/progression-service.js';
import { consumeLife, getLivesStatus } from '../services/lives-service.js';
import { normalizeAndCompare as normalizeAndCompare } from '../services/text-normalizer.js';
import { generateForTier } from '../services/game/generators/index.js';
import { pickNext, recordAnswer, applyPoolSwipe } from '../services/learning-service.js';

/**
 * Routes для learning-flow v2: лестница pool/passive/active/review/mastered.
 *
 * Endpoints:
 *   GET  /api/learning/next   — следующая карточка по приоритету или session_complete
 *   POST /api/learning/answer — записать ответ (L1/L2 isCorrect, L3 grade)
 *   POST /api/learning/swipe  — L0 swipe (know / learn / snooze)
 */

export default async function learningRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // ─── GET /api/learning/next ────────────────────────────────────────────
  app.get<{
    Querystring: {
      collectionId?: string;
      excludeWordIds?: string;
    };
  }>('/api/learning/next', async (request) => {
    const userId = request.user.id;
    const collectionId = request.query.collectionId ? Number(request.query.collectionId) : undefined;
    const validCollectionId =
      typeof collectionId === 'number' && !Number.isNaN(collectionId) ? collectionId : undefined;
    // Cap 10: защита от случайного rage клиента. Окно anti-repeat в норме = 3.
    // Важно: Number('') === 0, поэтому фильтруем пустые токены ДО Number().
    const rawExclude = request.query.excludeWordIds ?? '';
    const excludeWordIds = rawExclude
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .map(Number)
      .filter((n) => Number.isFinite(n))
      .slice(-10);

    const pick = await pickNext(userId, {
      collectionId: validCollectionId,
      excludeWordIds,
    });

    if (pick.kind === 'session_complete') {
      return {
        mode: 'session_complete' as const,
        reason: pick.reason,
        nextDueAt: pick.nextDueAt,
        counts: pick.counts,
        dailyPromotions: pick.dailyPromotions,
      };
    }

    const generated = await generateForTier(pick.wordId, pick.tier);
    if (!generated) {
      // Tier есть, но сгенерировать не удалось (нет eligible meaning, и т.п.).
      console.log(`[v2/next] ⚠ generator returned null for wordId=${pick.wordId} tier=${pick.tier} — отдаём session_complete клиенту`);
      return {
        mode: 'session_complete' as const,
        reason: 'collection_exhausted' as const,
        nextDueAt: null,
        counts: { pool: 0, passive: 0, active: 0, review: 0, mastered: 0 },
        dailyPromotions: pick.dailyPromotions,
      };
    }

    await recordEvent({
      userId,
      eventType: 'question_shown',
      wordId: pick.wordId,
      // recordEvent сам маппит v2 → legacy enum для БД
      tierBefore: pick.tier,
      tierAfter: pick.tier,
      questionType: generated.question.type,
    });

    return {
      question: generated.question,
      tier: pick.tier,
      wordId: pick.wordId,
      dailyPromotions: pick.dailyPromotions,
      batchStarted: pick.batchStarted ?? false,
      batchSize: pick.batchSize ?? 0,
    };
  });

  // ─── POST /api/learning/answer ──────────────────────────────────────
  app.post<{
    Body: {
      wordId: number;
      isCorrect?: boolean;
      grade?: 'again' | 'hard' | 'good' | 'easy';
      questionType?: string;
      answerTimeMs?: number;
      streak?: number;
      skip?: boolean;
      userAnswer?: string;
      acceptableAnswers?: string[];
      partOfSpeech?: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
    };
  }>('/api/learning/answer', async (request, reply) => {
    const userId = request.user.id;
    const {
      wordId,
      grade,
      questionType,
      answerTimeMs,
      streak = 0,
      skip = false,
      userAnswer,
      acceptableAnswers,
      partOfSpeech,
    } = request.body;

    if (typeof wordId !== 'number' || !Number.isFinite(wordId)) {
      reply.code(400);
      return { error: 'wordId required' };
    }

    // Серверная перевалидация свободного ввода.
    let isCorrect = request.body.isCorrect ?? false;
    let normalizedVia: 'exact' | 'typo' | 'none' | null = null;
    let correctedTo: string | undefined;
    if (userAnswer !== undefined && acceptableAnswers && acceptableAnswers.length > 0) {
      const result = normalizeAndCompare(userAnswer, acceptableAnswers, { partOfSpeech });
      isCorrect = result.match;
      normalizedVia = result.via;
      correctedTo = result.correctedTo;
    }

    const res = await recordAnswer({
      userId,
      wordId,
      isCorrect,
      grade,
      questionType,
      answerTimeMs,
      skip,
    });
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const verdict = isCorrect ? '✓' : '✗';
    const gradeStr = grade ? ` grade=${grade}` : '';
    const transition = res.tierBefore !== res.tierAfter ? ` ${res.tierBefore}→${res.tierAfter}` : '';
    console.log(`[${time}] [v2/answer u=${userId} w=${wordId}] ${verdict}${gradeStr} tier=${res.tierAfter}${transition}${res.becameMastered ? ' MASTERED' : ''}`);

    // Награды и жизни.
    let xpEarned = 0;
    let xpModifier: number | undefined;
    let totalXp: number | undefined;
    let level: number | undefined;
    let levelUp: number | undefined;
    let lpEarned = 0;
    let lpModifier: number | undefined;
    let totalLp: number | undefined;
    let gemsEarned = 0;

    if (isCorrect) {
      const reward = await rewardCorrectAnswer(userId, streak, XP_CORRECT_ANSWER);
      xpEarned = reward.xpEarned;
      xpModifier = reward.xpModifier;
      totalXp = reward.totalXp;
      level = reward.level;
      levelUp = reward.levelUp;
      lpEarned = reward.lpEarned;
      lpModifier = reward.lpModifier;
      totalLp = reward.totalLp;
      gemsEarned = reward.gemsEarned;
      await updateStreakDays(userId);
    } else if (!skip) {
      await consumeLife(userId);
    }

    const livesStatus = await getLivesStatus(userId);

    return {
      isCorrect,
      normalizedVia,
      correctedTo,
      tierBefore: res.tierBefore,
      tierAfter: res.tierAfter,
      wasAdvanced: res.wasAdvanced,
      wasReset: res.wasReset,
      becameMastered: res.becameMastered,
      nextReviewAt: res.nextReviewAt,
      xpEarned,
      xpModifier,
      totalXp,
      level,
      levelUp,
      lpEarned,
      lpModifier,
      totalLp,
      gemsEarned,
      lives: livesStatus.lives,
      livesRestoredAt: livesStatus.livesRestoredAt,
      livesExhausted: livesStatus.lives <= 0 && !livesStatus.isInfinite,
    };
  });

  // ─── POST /api/learning/swipe ──────────────────────────────────────────
  //   Свайп на L0 pool-карточке. action ∈ {know, learn, snooze}.
  //   Возвращает batchStarted=true когда свайп «learn» довёл пул до batchSize
  //   и сработал maybePromoteBatch. UI показывает экран «Ты отобрал N слов».
  app.post<{
    Body: {
      wordId: number;
      action: 'know' | 'learn' | 'snooze';
      snoozeDays?: number;
      collectionId?: number;
    };
  }>('/api/learning/swipe', async (request, reply) => {
    const userId = request.user.id;
    const { wordId, action, snoozeDays, collectionId } = request.body;
    if (typeof wordId !== 'number' || !Number.isFinite(wordId)) {
      reply.code(400);
      return { ok: false, error: 'wordId required' };
    }
    if (action !== 'know' && action !== 'learn' && action !== 'snooze') {
      reply.code(400);
      return { ok: false, error: 'invalid action' };
    }
    const result = await applyPoolSwipe({ userId, wordId, action, snoozeDays, collectionId });
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const batchInfo = result.batchStarted ? ` batch=${result.batchSize}` : '';
    console.log(`[${time}] [v2/swipe u=${userId} w=${wordId}] action=${action}${batchInfo}`);
    return {
      ok: true,
      batchStarted: result.batchStarted,
      batchSize: result.batchSize,
    };
  });
}
