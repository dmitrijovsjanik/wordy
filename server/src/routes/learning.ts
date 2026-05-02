import type { FastifyInstance } from 'fastify';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordMeanings, userWordProgress } from '../db/schema.js';
import { pickNextItem, recordAnswer, applySwipe } from '../services/learning-service.js';
import { generateForTier } from '../services/game/generators/index.js';
import type { PooledMeaning } from '../services/game/types.js';
import { recordEvent } from '../services/analytics-service.js';
import {
  rewardCorrectAnswer,
  updateStreakDays,
  XP_CORRECT_ANSWER,
} from '../services/progression-service.js';
import { consumeLife, getLivesStatus } from '../services/lives-service.js';
import { normalizeAndCompare } from '../services/text-normalizer.js';

/**
 * Routes для нового потока обучения (фаза 3).
 *
 * Существуют параллельно со старым `/api/quiz/*` flow. Клиент в фазе 3
 * переключается на эти маршруты постепенно: home.tsx идёт сюда, остальные
 * экраны (grammar/reading/duels/match-pairs) остаются на старом quiz API.
 */

/**
 * Найти неизученное слово в активных коллекциях пользователя и создать
 * для него encounter-запись. Возвращает meaning_id или null.
 */
async function introduceUnseenMeaning(userId: number): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT wm.id AS meaning_id
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    WHERE wm.id IN (
      SELECT cw.meaning_id FROM collection_words cw
      JOIN user_collections uc ON uc.collection_id = cw.collection_id
      WHERE uc.user_id = ${userId} AND uc.is_active = true
    )
      AND wm.id NOT IN (
        SELECT meaning_id FROM user_word_progress WHERE user_id = ${userId}
      )
      AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
    ORDER BY w.frequency_rank NULLS LAST
    LIMIT 1
  `);
  const row = (result as unknown as { rows: Array<{ meaning_id: number }> }).rows[0];
  if (!row) return null;

  const meaningId = Number(row.meaning_id);

  // Создаём encounter-запись. ON CONFLICT — на случай race condition.
  await db
    .insert(userWordProgress)
    .values({
      userId,
      meaningId,
      state: 'learning',
      learningTier: 'encounter',
      tierCorrectCount: 0,
      nextReviewAt: new Date(),
      lastSeenAt: new Date(),
    })
    .onConflictDoNothing();

  return meaningId;
}

async function loadPooledMeaning(meaningId: number): Promise<PooledMeaning | null> {
  const meaning = await db.query.wordMeanings.findFirst({
    where: eq(wordMeanings.id, meaningId),
    with: { word: true },
    columns: {
      id: true,
      wordId: true,
      translation: true,
      alternativeTranslations: true,
      difficulty: true,
      partOfSpeech: true,
      synonyms: true,
      examples: true,
    },
  });
  if (!meaning) return null;
  return meaning as PooledMeaning;
}

export default async function learningRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // ─── GET /api/learning/next ────────────────────────────────────────────
  // Возвращает следующее упражнение по приоритету tier'ов.

  app.get<{ Querystring: { generators?: string } }>('/api/learning/next', async (request) => {
    const userId = request.user.id;
    const generatorsStr = request.query.generators ?? '';
    const recentGenerators = generatorsStr ? generatorsStr.split(',').filter(Boolean) : [];

    // 1) Пробуем выбрать из текущего прогресса.
    let pick = await pickNextItem(userId);

    // 2) Если ничего не готово — вводим новое неизученное слово.
    if (!pick) {
      const newMeaningId = await introduceUnseenMeaning(userId);
      if (newMeaningId !== null) {
        pick = { meaningId: newMeaningId, tier: 'encounter' };
      }
    }

    if (!pick) {
      return { question: null, tier: null };
    }

    const meaning = await loadPooledMeaning(pick.meaningId);
    if (!meaning) {
      return { question: null, tier: null };
    }

    const generated = await generateForTier(meaning, pick.tier, { recentGenerators });
    if (!generated) {
      return { question: null, tier: null };
    }

    // Аналитика: question_shown.
    await recordEvent({
      userId,
      eventType: 'question_shown',
      meaningId: pick.meaningId,
      tierBefore: pick.tier,
      tierAfter: pick.tier,
      questionType: generated.generatorType,
    });

    return { question: generated.question, tier: pick.tier };
  });

  // ─── POST /api/learning/answer ─────────────────────────────────────────
  // Записывает ответ + вычисляет новые tier/intervals + начисляет XP/жизни.

  app.post<{
    Body: {
      meaningId: number;
      isCorrect: boolean;
      questionType?: string;
      answerTimeMs?: number;
      streak?: number;
      skip?: boolean;
      // Свободный ввод: если userAnswer + acceptableAnswers заданы, сервер
      // перепроверяет через text-normalizer (с леммой и Левенштейном),
      // переопределяя isCorrect клиента.
      userAnswer?: string;
      acceptableAnswers?: string[];
      partOfSpeech?: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
    };
  }>('/api/learning/answer', async (request) => {
    const userId = request.user.id;
    const {
      meaningId,
      questionType,
      answerTimeMs,
      streak = 0,
      skip = false,
      userAnswer,
      acceptableAnswers,
      partOfSpeech,
    } = request.body;

    // Серверная перевалидация для свободного ввода. Доверяем клиенту, только
    // если он не прислал userAnswer (multiple-choice — клиент проверяет сам).
    let isCorrect = request.body.isCorrect;
    let normalizedVia: 'exact' | 'lemma' | 'typo' | 'none' | null = null;
    if (userAnswer !== undefined && acceptableAnswers && acceptableAnswers.length > 0) {
      const result = normalizeAndCompare(userAnswer, acceptableAnswers, { partOfSpeech });
      isCorrect = result.match;
      normalizedVia = result.via;
    }

    // 1) Tier-машина + analytics events внутри recordAnswer.
    const tierResult = await recordAnswer({
      userId,
      meaningId,
      isCorrect,
      questionType,
      answerTimeMs,
    });

    // 2) Награды и жизни (без gems за streak/daily milestones — TODO в фазе 5).
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

      // Обновляем streak дней (если первый ответ за сегодня).
      // updateStreakDays идемпотентен — внутри проверяет дату.
      await updateStreakDays(userId);
    } else if (!skip) {
      await consumeLife(userId);
    }

    const livesStatus = await getLivesStatus(userId);

    return {
      isCorrect,
      normalizedVia, // 'exact' | 'lemma' | 'typo' | 'none' | null — null если перевалидации не было
      tierBefore: tierResult.tierBefore,
      tierAfter: tierResult.tierAfter,
      becameLearned: tierResult.becameLearned,
      wasReset: tierResult.wasReset,
      nextReviewAt: tierResult.nextReviewAt,
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
  // Используется режимом обзора (фаза 4). Сейчас заявлен заранее, чтобы клиент
  // мог его дёрнуть из онбординга/обзора как только UI появится.

  app.post<{
    Body: {
      meaningId: number;
      action: 'known' | 'unknown' | 'snooze';
      snoozeDays?: number;
    };
  }>('/api/learning/swipe', async (request) => {
    const userId = request.user.id;
    const { meaningId, action, snoozeDays } = request.body;
    await applySwipe({ userId, meaningId, action, snoozeDays });
    return { ok: true };
  });
}
