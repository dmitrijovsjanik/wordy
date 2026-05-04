import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordMeanings, userWordProgress, userWordProgressWord } from '../db/schema.js';
import { NON_FUNCTIONAL_SQL } from '../db/word-filters.js';
import {
  recordAnswer,
  pickNextItemCombined,
  recordWordAnswer,
  applyWordSwipe,
  undoWordSwipe,
  promoteWordToReview,
} from '../services/learning-service.js';
import {
  getProblemMeanings,
  getProblemMeaningsCount,
  pickNextProblemMeaning,
} from '../services/problem-meanings-service.js';
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
 * для него word-level encounter-запись. Возвращает word_id или null.
 *
 * Учётная единица — Word, не WordSense. Слова, у которых пользователь
 * прошёл хотя бы одно meaning через старую систему, уже забекфилены в
 * user_word_progress_word — они тут не появятся.
 */
async function introduceUnseenWord(userId: number, collectionId?: number): Promise<number | null> {
  const collectionFilter = typeof collectionId === 'number'
    ? sql`wm.id IN (SELECT cw.meaning_id FROM collection_words cw WHERE cw.collection_id = ${collectionId})`
    : sql`wm.id IN (
        SELECT cw.meaning_id FROM collection_words cw
        JOIN user_collections uc ON uc.collection_id = cw.collection_id
        WHERE uc.user_id = ${userId} AND uc.is_active = true
      )`;

  const result = await db.execute(sql`
    SELECT w.id AS word_id
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    WHERE ${collectionFilter}
      AND w.id NOT IN (
        SELECT word_id FROM user_word_progress_word WHERE user_id = ${userId}
      )
      AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
      AND ${NON_FUNCTIONAL_SQL}
    GROUP BY w.id, w.frequency_rank
    ORDER BY w.frequency_rank NULLS LAST
    LIMIT 1
  `);
  const row = (result as unknown as { rows: Array<{ word_id: number }> }).rows[0];
  if (!row) return null;

  const wordId = Number(row.word_id);

  await db
    .insert(userWordProgressWord)
    .values({
      userId,
      wordId,
      state: 'learning',
      learningTier: 'encounter',
      tierCorrectCount: 0,
      nextReviewAt: new Date(),
      lastSeenAt: new Date(),
    })
    .onConflictDoNothing();

  return wordId;
}

/**
 * Подобрать репрезентативный meaning слова для генерации L1-3 вопроса.
 * Берёт meaning с минимальным popularity_rank (самый частотный перевод)
 * среди eligible meanings. На Phase D генераторы переедут на работу со
 * списком всех meanings слова — тогда эта функция уйдёт.
 */
async function pickRepresentativeMeaning(wordId: number): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT wm.id
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    WHERE wm.word_id = ${wordId}
      AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
      AND ${NON_FUNCTIONAL_SQL}
    ORDER BY wm.popularity_rank NULLS LAST, wm.id
    LIMIT 1
  `);
  const row = (result as unknown as { rows: Array<{ id: number }> }).rows[0];
  return row ? Number(row.id) : null;
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

  app.get<{ Querystring: { generators?: string; collectionId?: string; exclude?: string } }>('/api/learning/next', async (request) => {
    const userId = request.user.id;
    const generatorsStr = request.query.generators ?? '';
    const recentGenerators = generatorsStr ? generatorsStr.split(',').filter(Boolean) : [];
    const collectionId = request.query.collectionId ? Number(request.query.collectionId) : undefined;
    const validCollectionId = typeof collectionId === 'number' && !Number.isNaN(collectionId) ? collectionId : undefined;
    const excludeStr = request.query.exclude ?? '';
    const excludeIds = excludeStr
      ? excludeStr.split(',').map(Number).filter(n => Number.isFinite(n))
      : [];

    // Возвращаемая структура: либо word-level (kind='word'), либо meaning-level (kind='meaning').
    // Клиент использует wordId/meaningId из ответа для последующего /answer.
    type Pick =
      | { kind: 'word'; wordId: number; meaningId: number; tier: 'encounter' | 'passive' | 'active' | 'production' | 'review' }
      | { kind: 'meaning'; meaningId: number; tier: 'encounter' | 'passive' | 'active' | 'production' | 'review' };

    let pick: Pick | null = null;

    {
      // excludeIds могут быть word_id (с word-level next) ИЛИ meaning_id.
      // Для безопасности передаём их и туда и туда.
      const combined = await pickNextItemCombined(userId, {
        collectionId: validCollectionId,
        excludeWordIds: excludeIds,
        excludeMeaningIds: excludeIds,
      });

      if (combined?.kind === 'word') {
        const meaningId = await pickRepresentativeMeaning(combined.wordId);
        if (meaningId !== null) {
          pick = { kind: 'word', wordId: combined.wordId, meaningId, tier: combined.tier };
        }
      } else if (combined?.kind === 'meaning') {
        pick = { kind: 'meaning', meaningId: combined.meaningId, tier: combined.tier };
      }

      // Если ничего не готово — вводим новое слово (word-level encounter).
      if (!pick) {
        const newWordId = await introduceUnseenWord(userId, validCollectionId);
        if (newWordId !== null) {
          const meaningId = await pickRepresentativeMeaning(newWordId);
          if (meaningId !== null) {
            pick = { kind: 'word', wordId: newWordId, meaningId, tier: 'encounter' };
          }
        }
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

    // Аналитика: question_shown. Поле word_id или meaning_id зависит от kind.
    await recordEvent({
      userId,
      eventType: 'question_shown',
      meaningId: pick.kind === 'meaning' ? pick.meaningId : null,
      wordId: pick.kind === 'word' ? pick.wordId : null,
      tierBefore: pick.tier,
      tierAfter: pick.tier,
      questionType: generated.generatorType,
    });

    // Обогащаем ответ wordId на верхнем уровне (для word-level pick'а).
    // Клиент использует его при /answer для маршрутизации в word vs meaning.
    return {
      question: generated.question,
      tier: pick.tier,
      wordId: pick.kind === 'word' ? pick.wordId : null,
    };
  });

  // ─── POST /api/learning/answer ─────────────────────────────────────────
  // Записывает ответ + вычисляет новые tier/intervals + начисляет XP/жизни.

  app.post<{
    Body: {
      /** Word-level ответ (L1-3 + word-review). Если задан — игнорируем meaningId. */
      wordId?: number;
      /** Meaning-level ответ (L4 production + per-meaning rollback). */
      meaningId?: number;
      isCorrect: boolean;
      questionType?: string;
      answerTimeMs?: number;
      streak?: number;
      skip?: boolean;
      /** Демо-режим: после recordAnswer форсированно продвигает tier на
       *  следующий, независимо от tcc и правильности. 1 показ на уровень. */
      demo?: boolean;
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
      wordId,
      meaningId,
      questionType,
      answerTimeMs,
      streak = 0,
      skip = false,
      demo = false,
      userAnswer,
      acceptableAnswers,
      partOfSpeech,
    } = request.body;

    // Серверная перевалидация для свободного ввода.
    let isCorrect = request.body.isCorrect;
    let normalizedVia: 'exact' | 'lemma' | 'typo' | 'none' | null = null;
    if (userAnswer !== undefined && acceptableAnswers && acceptableAnswers.length > 0) {
      const result = normalizeAndCompare(userAnswer, acceptableAnswers, { partOfSpeech });
      isCorrect = result.match;
      normalizedVia = result.via;
    }

    // ─── Маршрутизация: word-level vs meaning-level ──────────────────────
    const isWordLevel = typeof wordId === 'number' && Number.isFinite(wordId);

    let tierResult: {
      tierBefore: 'encounter' | 'passive' | 'active' | 'production' | 'review';
      tierAfter: 'encounter' | 'passive' | 'active' | 'production' | 'review';
      becameLearned: boolean;
      wasReset: boolean;
      nextReviewAt: Date;
    };

    if (isWordLevel) {
      // L1-3 + word-review. Записываем в user_word_progress_word.
      const wordRes = await recordWordAnswer({
        userId,
        wordId: wordId!,
        isCorrect,
        questionType,
        answerTimeMs,
        skip,
      });
      tierResult = {
        tierBefore: wordRes.tierBefore,
        tierAfter: wordRes.tierAfter,
        becameLearned: wordRes.becameLearned,
        wasReset: wordRes.wasReset,
        nextReviewAt: wordRes.nextReviewAt,
      };
    } else {
      // L4 production + per-meaning rollback. meaningId обязателен.
      if (typeof meaningId !== 'number') {
        return { error: 'meaningId or wordId required' };
      }
      const meaningRes = await recordAnswer({
        userId,
        meaningId,
        isCorrect,
        questionType,
        answerTimeMs,
        skip,
      });
      tierResult = meaningRes;

      // Если meaning перешёл production → review, проверяем все ли значения
      // слова достигли review. Если да — продвигаем word-level запись.
      if (meaningRes.becameLearned && meaningRes.tierBefore === 'production') {
        const wmRow = await db.execute(sql`SELECT word_id FROM word_meanings WHERE id = ${meaningId}`);
        const meaningWordId = (wmRow as unknown as { rows: Array<{ word_id: number }> }).rows[0]?.word_id;
        if (typeof meaningWordId === 'number') {
          await promoteWordToReview(userId, Number(meaningWordId));
        }
      }
    }

    // ─── Demo: форсированно продвигаем на следующий tier ────────────────
    if (demo) {
      const nextTier = (() => {
        switch (tierResult.tierBefore) {
          case 'encounter': return 'passive';
          case 'passive': return 'active';
          case 'active': return 'production';
          case 'production': return 'review';
          case 'review': return null;
          default: return null;
        }
      })();

      if (isWordLevel) {
        // Word-level demo:
        //   - encounter/passive/active → продвигаем word-tier вперёд
        //   - active → production: создаём meaning-записи через transitionWordToProduction
        //     (это произойдёт в recordWordAnswer когда demo=true даст enteredProduction;
        //      но мы override'или результат через UPDATE, поэтому надо вызвать вручную).
        //     В demo-flow при active→production сервер должен создать meaning-records,
        //     иначе следующий /next не найдёт ничего на L4.
        //   - production word-tier тоже двигаем на review через promote
        if (nextTier !== null && nextTier !== 'production') {
          await db.update(userWordProgressWord).set({
            learningTier: nextTier,
            tierCorrectCount: 0,
            nextReviewAt: new Date(),
            hasPenalty: false,
          }).where(and(
            eq(userWordProgressWord.userId, userId),
            eq(userWordProgressWord.wordId, wordId!),
          ));
        } else if (nextTier === 'production') {
          // active → production для demo: word уходит в production, создаём
          // meaning-записи. recordWordAnswer должен был это сделать через
          // transitionWordToProduction если бы tcc дотянул. Принудительно.
          await db.update(userWordProgressWord).set({
            learningTier: 'production',
            tierCorrectCount: 0,
            nextReviewAt: new Date(),
            hasPenalty: false,
          }).where(and(
            eq(userWordProgressWord.userId, userId),
            eq(userWordProgressWord.wordId, wordId!),
          ));
          // Создание meaning-записей тут было бы дублированием логики.
          // recordWordAnswer уже мог их создать при tier='production'.
          // Если нет — clean-up принудительно через сервисную функцию:
          // (impl: если нет meaning-записей на production у слова, делаем insert)
          const existing = await db.select({ id: userWordProgress.id })
            .from(userWordProgress)
            .innerJoin(wordMeanings, eq(wordMeanings.id, userWordProgress.meaningId))
            .where(and(
              eq(userWordProgress.userId, userId),
              eq(wordMeanings.wordId, wordId!),
              eq(userWordProgress.learningTier, 'production'),
            ))
            .limit(1);
          if (existing.length === 0) {
            // Возьмём eligible meanings и вставим
            const eligible = await db.execute(sql`
              SELECT wm.id FROM word_meanings wm JOIN words w ON w.id = wm.word_id
              WHERE wm.word_id = ${wordId}
                AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
                AND (wm.frequency IS NULL OR wm.frequency >= 5)
                AND wm.translation ~ '[а-яА-ЯёЁ]'
                AND ${NON_FUNCTIONAL_SQL}
            `);
            const ids = (eligible as unknown as { rows: Array<{ id: number }> }).rows.map(r => Number(r.id));
            for (const mid of ids) {
              await db.insert(userWordProgress).values({
                userId, meaningId: mid, state: 'learning',
                learningTier: 'production', tierCorrectCount: 0,
                nextReviewAt: new Date(), lastSeenAt: new Date(),
              }).onConflictDoNothing();
            }
          }
        } else {
          // Был review → демо завершено: ставим state='known_from_review'.
          await db.update(userWordProgressWord).set({
            state: 'known_from_review',
          }).where(and(
            eq(userWordProgressWord.userId, userId),
            eq(userWordProgressWord.wordId, wordId!),
          ));
        }
      } else {
        // Meaning-level demo (L4 production)
        if (nextTier !== null) {
          await db.update(userWordProgress).set({
            learningTier: nextTier,
            tierCorrectCount: 0,
            nextReviewAt: new Date(),
            hasPenalty: false,
          }).where(and(
            eq(userWordProgress.userId, userId),
            eq(userWordProgress.meaningId, meaningId!),
          ));
        } else {
          await db.update(userWordProgress).set({
            state: 'known_from_review',
          }).where(and(
            eq(userWordProgress.userId, userId),
            eq(userWordProgress.meaningId, meaningId!),
          ));
        }
      }
    }

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
      /** Word-level swipe (новый flow). */
      wordId?: number;
      wordIds?: number[];
      /** Legacy: meaning-level swipe. Резолвится в wordId через JOIN. */
      meaningId?: number;
      meaningIds?: number[];
      action: 'known' | 'unknown' | 'snooze';
      snoozeDays?: number;
    };
  }>('/api/learning/swipe', async (request) => {
    const userId = request.user.id;
    const { wordId, wordIds, meaningId, meaningIds, action, snoozeDays } = request.body;

    // Собираем wordIds: явно переданные + резолв из meaningIds.
    const explicitWordIds = wordIds && wordIds.length > 0
      ? wordIds
      : (typeof wordId === 'number' ? [wordId] : []);

    const meaningInputs = meaningIds && meaningIds.length > 0
      ? meaningIds
      : (typeof meaningId === 'number' ? [meaningId] : []);

    let resolvedWordIds: number[] = [...explicitWordIds];
    if (meaningInputs.length > 0) {
      const rows = await db.execute(sql`
        SELECT DISTINCT word_id FROM word_meanings
        WHERE id IN (${sql.join(meaningInputs.map(id => sql`${id}`), sql`, `)})
      `);
      const fromMeanings = (rows as unknown as { rows: Array<{ word_id: number }> }).rows.map(r => Number(r.word_id));
      resolvedWordIds = [...new Set([...resolvedWordIds, ...fromMeanings])];
    }

    if (resolvedWordIds.length === 0) return { ok: false };

    for (const id of resolvedWordIds) {
      await applyWordSwipe({ userId, wordId: id, action, snoozeDays });
    }
    return { ok: true };
  });

  // ─── POST /api/learning/mnemonic-revealed ──────────────────────────────
  // Логирует факт раскрытия AI-мнемоники на passive-recall карточке.
  // Источник для будущей оценки полезности AI-контента.

  app.post<{ Body: { meaningId: number } }>('/api/learning/mnemonic-revealed', async (request) => {
    const userId = request.user.id;
    const { meaningId } = request.body;
    if (typeof meaningId !== 'number') return { ok: false };
    await recordEvent({
      userId,
      eventType: 'mnemonic_revealed',
      meaningId,
      questionType: 'passive-recall',
    });
    return { ok: true };
  });

  // ─── GET /api/learning/problems ────────────────────────────────────────
  // Список «проблемных» meaning'ов (≥3 ошибок за 60 дней) + общий count.

  app.get('/api/learning/problems', async (request) => {
    const userId = request.user.id;
    const meanings = await getProblemMeanings(userId);
    return {
      count: meanings.length,
      meanings,
    };
  });

  // ─── GET /api/learning/problems/count ──────────────────────────────────
  // Только число — для бейджа на главной без загрузки списка.

  app.get('/api/learning/problems/count', async (request) => {
    const userId = request.user.id;
    const count = await getProblemMeaningsCount(userId);
    return { count };
  });

  // ─── GET /api/learning/problems/next ───────────────────────────────────
  // Следующее проблемное слово для повторения. Генерирует упражнение через
  // тот же generateForTier, что и обычный поток — слово показывается на
  // своём текущем tier'е лестницы.

  app.get<{ Querystring: { generators?: string; exclude?: string } }>(
    '/api/learning/problems/next',
    async (request) => {
      const userId = request.user.id;
      const generatorsStr = request.query.generators ?? '';
      const recentGenerators = generatorsStr ? generatorsStr.split(',').filter(Boolean) : [];
      const excludeStr = request.query.exclude ?? '';
      const excludeIds = excludeStr
        ? excludeStr.split(',').map(Number).filter((n) => !Number.isNaN(n))
        : [];

      const pick = await pickNextProblemMeaning(userId, excludeIds);
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

      // Аналитика: question_shown в режиме проблемных слов.
      await recordEvent({
        userId,
        eventType: 'question_shown',
        meaningId: pick.meaningId,
        tierBefore: pick.tier,
        tierAfter: pick.tier,
        questionType: generated.generatorType,
        payload: { source: 'problems' },
      });

      return { question: generated.question, tier: pick.tier };
    },
  );

  // POST /api/learning/undo-swipe — откат последнего свайпа (жест «вниз» в обзоре).
  // Word-level. Если передан только meaningId — резолвим wordId через JOIN.
  app.post<{
    Body: {
      wordId?: number;
      meaningId?: number;
      originalAction?: 'known' | 'unknown' | 'snooze';
    };
  }>('/api/learning/undo-swipe', async (request) => {
    const userId = request.user.id;
    const { wordId, meaningId, originalAction } = request.body;
    let resolvedWordId = wordId;
    if (typeof resolvedWordId !== 'number' && typeof meaningId === 'number') {
      const row = await db.execute(sql`SELECT word_id FROM word_meanings WHERE id = ${meaningId}`);
      const w = (row as unknown as { rows: Array<{ word_id: number }> }).rows[0]?.word_id;
      if (typeof w === 'number') resolvedWordId = Number(w);
    }
    if (typeof resolvedWordId !== 'number') return { ok: false };
    await undoWordSwipe(userId, resolvedWordId, originalAction);
    return { ok: true };
  });
}
