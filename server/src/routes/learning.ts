import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordMeanings, userWordProgress, userWordProgressWord, users } from '../db/schema.js';
import { NON_FUNCTIONAL_SQL } from '../db/word-filters.js';
import { learningConfig } from '../config/learning-config.js';
import {
  recordAnswer,
  recordWordAnswer,
  applyWordSwipe,
  undoWordSwipe,
  promoteWordToReview,
  getActiveDeckSize,
  getPoolSize,
  drawFromPool,
  pickNextL1L3,
  pickNextProduction,
  pickNextReviewDue,
  type NextPick,
} from '../services/learning-service.js';
import { hasAvailableForReview } from '../services/review-feed-service.js';
import {
  decrementOnFetch as cooldownDecrementOnFetch,
  getExcludedWordIds as cooldownGetExcludedWordIds,
} from '../services/cooldown-service.js';
import {
  getCurrentSlot,
  advanceSlot,
  type QuotaSlot,
} from '../services/quota-service.js';
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

  app.get<{
    Querystring: {
      generators?: string;
      collectionId?: string;
      excludeWordIds?: string;
      excludeMeaningIds?: string;
    };
  }>('/api/learning/next', async (request) => {
    const userId = request.user.id;
    const generatorsStr = request.query.generators ?? '';
    const recentGenerators = generatorsStr ? generatorsStr.split(',').filter(Boolean) : [];
    const collectionId = request.query.collectionId ? Number(request.query.collectionId) : undefined;
    const validCollectionId = typeof collectionId === 'number' && !Number.isNaN(collectionId) ? collectionId : undefined;
    const parseIds = (s: string | undefined): number[] =>
      s ? s.split(',').map(Number).filter((n) => Number.isFinite(n)) : [];
    const excludeWordIds = parseIds(request.query.excludeWordIds);
    const excludeMeaningIds = parseIds(request.query.excludeMeaningIds);

    // Шаг 1: при низкой активной колоде — добор из pending_pool.
    // Считаем только L1-L3 (encounter/passive/active). Production/review
    // не считаются — они про повторение, а не про темп новых слов.
    const activeBefore = await getActiveDeckSize(userId, validCollectionId);
    if (activeBefore <= learningConfig.activeDeck.threshold) {
      await drawFromPool(userId, learningConfig.activeDeck.target, activeBefore);
    }
    const poolNow = await getPoolSize(userId, validCollectionId);
    const activeAfterDraw = await getActiveDeckSize(userId, validCollectionId);

    // Шаг 1.5: ранний выход в embedded_review.
    // Если активная колода (L1-L3) пуста и pool тоже пуст — отправляем юзера
    // в обзор за новыми словами, ДАЖЕ если есть production-meanings или
    // review-due. Без этого юзер бесконечно крутит N meanings одного и того
    // же слова на L4 (decompose) — визуально это «3-4 слова повторяются».
    // Обзор возвращает контроль: юзер свайпает unknown → pool пополняется →
    // drawFromPool тянет в активную колоду → обычное обучение возобновляется.
    // Counter квоты НЕ сдвигается на embedded — слот возобновится после.
    if (activeAfterDraw === 0 && poolNow < learningConfig.activeDeck.poolMinForResume) {
      const userRow = await db
        .select({ cefr: users.estimatedCefr })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      const userCefr = userRow[0]?.cefr ?? null;
      const available = await hasAvailableForReview(userId, userCefr);
      if (!available) {
        return { mode: 'embedded_review_empty' as const };
      }
      return {
        mode: 'embedded_review' as const,
        poolSize: poolNow,
        poolMinForResume: learningConfig.activeDeck.poolMinForResume,
      };
    }

    // Шаг 2: cooldown. Один decrement на запрос; объединяем с client-side
    // recentWordIds (anti-repeat 2 последних). Все три pick-функции
    // (L1L3/production/review) уважают excludeWordIds.
    cooldownDecrementOnFetch(userId);
    const cooldownExcluded = cooldownGetExcludedWordIds(userId);
    const combinedExcludeWordIds = cooldownExcluded.length > 0
      ? [...new Set([...excludeWordIds, ...cooldownExcluded])]
      : excludeWordIds;

    type Pick =
      | { kind: 'word'; wordId: number; meaningId: number; tier: 'encounter' | 'passive' | 'active' | 'production' | 'review' }
      | { kind: 'meaning'; meaningId: number; tier: 'encounter' | 'passive' | 'active' | 'production' | 'review' };

    // Шаг 3: квота 4:1:1. Получаем текущий слот (НЕ инкрементируем — это
    // делаем только при фактическом возврате карточки в самом конце).
    const slot = getCurrentSlot(userId);

    // Резолверы для L1-L3 picks (kind='word' → нужен meaningId через
    // pickRepresentativeMeaning) и для review-picks (kind='word' тоже
    // требует meaningId; kind='meaning' идёт как есть).
    const resolveL1L3 = async (raw: Awaited<ReturnType<typeof pickNextL1L3>>): Promise<Pick | null> => {
      if (!raw) return null;
      const meaningId = await pickRepresentativeMeaning(raw.wordId);
      if (meaningId === null) return null;
      return { kind: 'word', wordId: raw.wordId, meaningId, tier: raw.tier };
    };

    const resolveReview = async (raw: NextPick | null): Promise<Pick | null> => {
      if (!raw) return null;
      if (raw.kind === 'meaning') {
        return { kind: 'meaning', meaningId: raw.meaningId, tier: raw.tier };
      }
      // word-level review: нужен meaningId.
      const meaningId = await pickRepresentativeMeaning(raw.wordId);
      if (meaningId === null) return null;
      return { kind: 'word', wordId: raw.wordId, meaningId, tier: raw.tier };
    };

    // Все три попытки в порядке для конкретного слота (с fallback'ами
    // согласно ТЗ).
    const tryMain = async (excludeW: number[]): Promise<Pick | null> =>
      resolveL1L3(await pickNextL1L3(userId, {
        excludeWordIds: excludeW,
        collectionId: validCollectionId,
      }));

    const tryProduction = async (excludeW: number[]): Promise<Pick | null> => {
      const raw = await pickNextProduction(userId, {
        excludeWordIds: excludeW,
        excludeMeaningIds,
        collectionId: validCollectionId,
      });
      if (!raw) return null;
      return { kind: 'meaning', meaningId: raw.meaningId, tier: raw.tier };
    };

    const tryReview = async (excludeW: number[]): Promise<Pick | null> =>
      resolveReview(await pickNextReviewDue(userId, {
        excludeWordIds: excludeW,
        excludeMeaningIds,
        collectionId: validCollectionId,
      }));

    // Порядок попыток для каждого слота:
    //   main       → main, production, review
    //   production → production, review, main
    //   review     → review, production, main
    const fallbackOrder: Record<QuotaSlot, Array<(ex: number[]) => Promise<Pick | null>>> = {
      main: [tryMain, tryProduction, tryReview],
      production: [tryProduction, tryReview, tryMain],
      review: [tryReview, tryProduction, tryMain],
    };

    let pick: Pick | null = null;
    for (const fn of fallbackOrder[slot]) {
      pick = await fn(combinedExcludeWordIds);
      if (pick) break;
    }

    // Retry без cooldown — на случай "main пуст из-за cooldown" (защита
    // от случая когда все слова в активной колоде временно блокированы
    // K-cooldown'ом). Применяем тот же fallback-порядок, передаём ТОЛЬКО
    // client-side recent (excludeWordIds из query — обычно последние 2
    // показанных слова). Cooldown снимается, recent остаётся жёстким —
    // это гарантирует, что retry не вернёт слово, на которое юзер только
    // что ответил. Если recent блокирует всех кандидатов → pick=null →
    // ниже сработает embedded_review (если активная колода+pool пусты).
    if (!pick && cooldownExcluded.length > 0) {
      for (const fn of fallbackOrder[slot]) {
        pick = await fn(excludeWordIds);
        if (pick) break;
      }
    }

    // Шаг 4: ничего нигде нет → проверяем, не пора ли в embedded review.
    // Условие то же что было: активная колода=0 И pool<min.
    // Counter квоты НЕ сдвигается на embedded — слот возобновится.
    if (!pick) {
      const activeAfter = await getActiveDeckSize(userId, validCollectionId);
      if (activeAfter === 0) {
        const poolSize = await getPoolSize(userId, validCollectionId);
        if (poolSize < learningConfig.activeDeck.poolMinForResume) {
          const userRow = await db
            .select({ cefr: users.estimatedCefr })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);
          const userCefr = userRow[0]?.cefr ?? null;
          const available = await hasAvailableForReview(userId, userCefr);
          if (!available) {
            return { mode: 'embedded_review_empty' as const };
          }
          return {
            mode: 'embedded_review' as const,
            poolSize,
            poolMinForResume: learningConfig.activeDeck.poolMinForResume,
          };
        }
      }
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

    // Counter квоты сдвигается ТОЛЬКО при фактическом возврате карточки
    // (через основной слот или fallback). Если loadPooledMeaning или
    // generateForTier вернули null, или сработал embedded_review/empty,
    // или ничего не нашлось — слот остаётся на той же позиции.
    advanceSlot(userId);

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

    if (resolvedWordIds.length === 0) {
      return { ok: false, poolSize: 0, activeDeckSize: 0 };
    }

    for (const id of resolvedWordIds) {
      await applyWordSwipe({ userId, wordId: id, action, snoozeDays });
    }
    // Размеры — после применения всех свайпов из батча. Клиент использует
    // poolSize чтобы решить, выйти ли из embedded review (poolMinForResume).
    const [poolSize, activeDeckSize] = await Promise.all([
      getPoolSize(userId),
      getActiveDeckSize(userId),
    ]);
    return { ok: true, poolSize, activeDeckSize };
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
