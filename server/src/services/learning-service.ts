/**
 * Learning Service V2 — новая лестница освоения слов.
 *
 *   L0 pool     → L1 passive (через свайп «Изучаю»)
 *   L1 passive  → L2 active  (2 правильных подряд)
 *   L2 active   → L3 review  (2 правильных подряд)
 *   L3 review   → mastered   (по SM-2 сетке, выпуск после 2 подряд good/easy на stage=7)
 *
 *   L0 «Знаю»   → L3 review stage=0 (1 день, невидимая проверка)
 *   L0 «Отложить» → state='pool_snoozed', snoozed_until=now+7±2 дней
 *   L3 «Снова»  → откат на L2
 *
 * Работает с new-полями user_word_progress_word: learning_tier / state /
 * consecutive_easy_or_good / last_grade / ef_factor. Поля старой схемы
 * (learning_tier / state) не трогаем — их обслуживает legacy learning-service.ts
 * до шага 4 миграции, где будет cleanup.
 *
 * Anti-repeat: K-cooldown удалён. Используется только recentWordIds, переданный
 * клиентом (последние 2-3 показанных слова).
 */

import { eq, and, sql, isNull, or, lte, type SQL } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userWordProgressWord, wordMeanings } from '../db/schema.js';
import { learningConfig } from '../config/learning-config.js';
import { recordEvent, type LearningTier } from './analytics-service.js';
import { NON_FUNCTIONAL_SQL } from '../db/word-filters.js';
import { getMskDailyResetStart } from '../lib/msk-date.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';

export type PoolSwipeAction = 'know' | 'learn' | 'snooze';

export type TransitionInput = {
  tier: LearningTier;
  tierCorrectCount: number;
  reviewStage: number;
  consecutiveEasyOrGood: number;
  /** Для L1/L2: правильность ответа. Для L3: undefined (используется grade). */
  isCorrect?: boolean;
  /** Для L3: оценка кнопкой. Для L1/L2: undefined. */
  grade?: ReviewGrade;
};

export type TransitionResult = {
  tier: LearningTier;
  tierCorrectCount: number;
  reviewStage: number;
  consecutiveEasyOrGood: number;
  nextReviewAt: Date;
  /** true когда тир продвинулся вперёд (passive→active, active→review, review→mastered). */
  wasAdvanced: boolean;
  /** true когда был откат (review→active по grade='again'). */
  wasReset: boolean;
  /** true когда слово выпущено из обучения (review→mastered). */
  becameMastered: boolean;
};

// ─── Pure tier-machine ──────────────────────────────────────────────────────

/**
 * Чистая функция перехода. Без БД, без now() — все timestamp'ы относительны
 * параметру `now`. Удобно для unit-тестов.
 *
 * Контракт:
 *   - L0 pool: переходы только через applyPoolSwipe (не через эту функцию)
 *   - L1 passive / L2 active: ждём isCorrect
 *   - L3 review: ждём grade
 *   - mastered: терминальный, не должен сюда попадать
 */
export function computeTransition(
  input: TransitionInput,
  now: Date = new Date(),
): TransitionResult {
  const { tier, tierCorrectCount, reviewStage, consecutiveEasyOrGood, isCorrect, grade } = input;
  const cfg = learningConfig.tiers[tier];

  // ─── pool ─────────────────────────────────────────────────────────────────
  // L0 — только через applyPoolSwipe. Сюда попасть не должны, но на всякий
  // случай возвращаем no-op.
  if (tier === 'pool') {
    return noopTransition(input, now);
  }

  // ─── passive (L1) ─────────────────────────────────────────────────────────
  if (tier === 'passive') {
    if (isCorrect === undefined) {
      // Программная ошибка: на L1 ждём isCorrect.
      return noopTransition(input, now);
    }
    if (!isCorrect) {
      // Сброс счётчика, остаёмся на L1. Откатов нет.
      return {
        tier: 'passive',
        tierCorrectCount: 0,
        reviewStage,
        consecutiveEasyOrGood,
        nextReviewAt: now,
        wasAdvanced: false,
        wasReset: false,
        becameMastered: false,
      };
    }
    const newCount = tierCorrectCount + 1;
    if (newCount >= cfg.correctToAdvance) {
      // L1 → L2
      return {
        tier: 'active',
        tierCorrectCount: 0,
        reviewStage,
        consecutiveEasyOrGood,
        nextReviewAt: now,
        wasAdvanced: true,
        wasReset: false,
        becameMastered: false,
      };
    }
    return {
      tier: 'passive',
      tierCorrectCount: newCount,
      reviewStage,
      consecutiveEasyOrGood,
      nextReviewAt: now,
      wasAdvanced: false,
      wasReset: false,
      becameMastered: false,
    };
  }

  // ─── active (L2) ──────────────────────────────────────────────────────────
  if (tier === 'active') {
    if (isCorrect === undefined) return noopTransition(input, now);
    if (!isCorrect) {
      return {
        tier: 'active',
        tierCorrectCount: 0,
        reviewStage,
        consecutiveEasyOrGood,
        nextReviewAt: now,
        wasAdvanced: false,
        wasReset: false,
        becameMastered: false,
      };
    }
    const newCount = tierCorrectCount + 1;
    if (newCount >= cfg.correctToAdvance) {
      // L2 → L3: вход в SRS на stage=0 (1 день).
      const stage0 = 0;
      const intervalDays = learningConfig.reviewGrid[stage0]!;
      return {
        tier: 'review',
        tierCorrectCount: 0,
        reviewStage: stage0,
        consecutiveEasyOrGood: 0,
        nextReviewAt: addDays(now, intervalDays),
        wasAdvanced: true,
        wasReset: false,
        becameMastered: false,
      };
    }
    return {
      tier: 'active',
      tierCorrectCount: newCount,
      reviewStage,
      consecutiveEasyOrGood,
      nextReviewAt: now,
      wasAdvanced: false,
      wasReset: false,
      becameMastered: false,
    };
  }

  // ─── review (L3) ──────────────────────────────────────────────────────────
  if (tier === 'review') {
    if (!grade) return noopTransition(input, now);

    // again → откат на L2.
    if (grade === 'again') {
      return {
        tier: 'active',
        tierCorrectCount: 0,
        reviewStage: 0,
        consecutiveEasyOrGood: 0,
        nextReviewAt: now,
        wasAdvanced: false,
        wasReset: true,
        becameMastered: false,
      };
    }

    const grid = learningConfig.reviewGrid;
    const lastStage = grid.length - 1; // = 7

    // На финальном stage 7:
    //   - hard: остаёмся на stage 7, счётчик СБРАСЫВАЕТСЯ (по решению юзера —
    //     hard рассматривается как слабый сигнал, не двигает к выпуску)
    //   - good/easy: счётчик +1, при reviewMasteredAfter → mastered
    if (reviewStage >= lastStage) {
      if (grade === 'hard') {
        const intervalDays = grid[lastStage]! * learningConfig.reviewGradeModifiers.hard;
        return {
          tier: 'review',
          tierCorrectCount: 0,
          reviewStage: lastStage,
          consecutiveEasyOrGood: 0, // hard сбрасывает счётчик выпуска
          nextReviewAt: addDays(now, intervalDays),
          wasAdvanced: false,
          wasReset: false,
          becameMastered: false,
        };
      }
      // good / easy на финале
      const newConsec = consecutiveEasyOrGood + 1;
      if (newConsec >= learningConfig.reviewMasteredAfter) {
        return {
          tier: 'mastered',
          tierCorrectCount: 0,
          reviewStage: lastStage,
          consecutiveEasyOrGood: newConsec,
          nextReviewAt: now, // не используется для mastered
          wasAdvanced: true,
          wasReset: false,
          becameMastered: true,
        };
      }
      // Ещё один шаг на финале до выпуска: интервал = grid[7] × modifier.
      const modifier = grade === 'easy'
        ? learningConfig.reviewGradeModifiers.easy
        : learningConfig.reviewGradeModifiers.good;
      return {
        tier: 'review',
        tierCorrectCount: 0,
        reviewStage: lastStage,
        consecutiveEasyOrGood: newConsec,
        nextReviewAt: addDays(now, grid[lastStage]! * modifier),
        wasAdvanced: false,
        wasReset: false,
        becameMastered: false,
      };
    }

    // Обычный шаг (stage < 7). nextInterval = grid[stage+1] * modifier.
    // Согласно решению по плану: модификатор применяется к следующему шагу
    // сетки, не к текущему интервалу (см. финализированный план).
    const nextStage = reviewStage + 1;
    const modifier = grade === 'hard'
      ? learningConfig.reviewGradeModifiers.hard
      : grade === 'easy'
        ? learningConfig.reviewGradeModifiers.easy
        : learningConfig.reviewGradeModifiers.good;
    return {
      tier: 'review',
      tierCorrectCount: 0,
      reviewStage: nextStage,
      consecutiveEasyOrGood: 0, // счётчик финала актуален только на stage=lastStage
      nextReviewAt: addDays(now, grid[nextStage]! * modifier),
      wasAdvanced: false,
      wasReset: false,
      becameMastered: false,
    };
  }

  // ─── mastered ─────────────────────────────────────────────────────────────
  // Терминальный, не должен сюда попадать.
  return noopTransition(input, now);
}

function noopTransition(input: TransitionInput, now: Date): TransitionResult {
  return {
    tier: input.tier,
    tierCorrectCount: input.tierCorrectCount,
    reviewStage: input.reviewStage,
    consecutiveEasyOrGood: input.consecutiveEasyOrGood,
    nextReviewAt: now,
    wasAdvanced: false,
    wasReset: false,
    becameMastered: false,
  };
}

// ─── Daily promotions counter ───────────────────────────────────────────────

/**
 * Возвращает текущее значение dailyPromotionsCount для пользователя, делая
 * ленивый сброс если dailyPromotionsDate относится к прошлому учебному дню
 * (день начинается в 02:00 MSK, см. [[getMskDailyResetStart]]).
 *
 * Если был ленивый сброс — обновляет БД до возврата.
 */
export async function getDailyPromotionsCount(userId: number): Promise<number> {
  const now = new Date();
  const todayStart = getMskDailyResetStart(now);

  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { dailyPromotionsCount: true, dailyPromotionsDate: true },
  });
  if (!row) return 0;

  const date = row.dailyPromotionsDate;
  if (date && date.getTime() >= todayStart.getTime()) {
    return row.dailyPromotionsCount;
  }

  // Stale → reset
  await db
    .update(users)
    .set({ dailyPromotionsCount: 0, dailyPromotionsDate: todayStart, updatedAt: now })
    .where(eq(users.id, userId));
  return 0;
}

/**
 * Атомарно инкрементирует dailyPromotionsCount на 1. Если dailyPromotionsDate
 * stale — счётчик сбрасывается в 1 (этот переход = первый за новый день).
 *
 * Возвращает новое значение счётчика.
 */
export async function incrementDailyPromotions(userId: number): Promise<number> {
  const now = new Date();
  const todayStart = getMskDailyResetStart(now);

  // CASE: если dailyPromotionsDate stale ИЛИ null → сброс на 1, дата = today.
  // Иначе → +1.
  const result = await db
    .update(users)
    .set({
      dailyPromotionsCount: sql`CASE
        WHEN ${users.dailyPromotionsDate} IS NULL OR ${users.dailyPromotionsDate} < ${todayStart}
        THEN 1
        ELSE ${users.dailyPromotionsCount} + 1
      END`,
      dailyPromotionsDate: todayStart,
      updatedAt: now,
    })
    .where(eq(users.id, userId))
    .returning({ count: users.dailyPromotionsCount });

  return result[0]?.count ?? 0;
}

// ─── Public API: recordAnswer ─────────────────────────────────────────────

export type RecordAnswerInput = {
  userId: number;
  wordId: number;
  isCorrect?: boolean;
  grade?: ReviewGrade;
  questionType?: string;
  answerTimeMs?: number;
  skip?: boolean;
};

export type RecordAnswerResult = {
  tierBefore: LearningTier;
  tierAfter: LearningTier;
  wasAdvanced: boolean;
  wasReset: boolean;
  becameMastered: boolean;
  nextReviewAt: Date;
};

export async function recordAnswer(input: RecordAnswerInput): Promise<RecordAnswerResult> {
  const { userId, wordId, isCorrect, grade, questionType, answerTimeMs, skip } = input;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(userWordProgressWord)
    .where(and(eq(userWordProgressWord.userId, userId), eq(userWordProgressWord.wordId, wordId)))
    .limit(1);

  // Если записи нет — слово впервые попадает в обучение, считаем что юзер
  // ответил на passive-карточке. Создаём запись на passive с tcc=0.
  const tierBefore: LearningTier = existing?.learningTier ?? 'passive';
  const tccBefore = existing?.tierCorrectCount ?? 0;
  const reviewStageBefore = existing?.reviewStage ?? 0;
  const consecBefore = existing?.consecutiveEasyOrGood ?? 0;

  const transition = computeTransition({
    tier: tierBefore,
    tierCorrectCount: tccBefore,
    reviewStage: reviewStageBefore,
    consecutiveEasyOrGood: consecBefore,
    isCorrect,
    grade,
  }, now);

  if (existing) {
    await db
      .update(userWordProgressWord)
      .set({
        learningTier: transition.tier,
        state: 'active',
        tierCorrectCount: transition.tierCorrectCount,
        reviewStage: transition.reviewStage,
        consecutiveEasyOrGood: transition.consecutiveEasyOrGood,
        nextReviewAt: transition.nextReviewAt,
        lastGrade: grade ?? existing.lastGrade,
        correctCount: isCorrect ? sql`${userWordProgressWord.correctCount} + 1` : userWordProgressWord.correctCount,
        incorrectCount: isCorrect === false ? sql`${userWordProgressWord.incorrectCount} + 1` : userWordProgressWord.incorrectCount,
        masteredAt: transition.becameMastered ? now : existing.masteredAt,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(userWordProgressWord.id, existing.id));
  } else {
    await db.insert(userWordProgressWord).values({
      userId,
      wordId,
      learningTier: transition.tier,
      state: 'active',
      tierCorrectCount: transition.tierCorrectCount,
      reviewStage: transition.reviewStage,
      consecutiveEasyOrGood: transition.consecutiveEasyOrGood,
      nextReviewAt: transition.nextReviewAt,
      lastGrade: grade ?? null,
      correctCount: isCorrect ? 1 : 0,
      incorrectCount: isCorrect === false ? 1 : 0,
      masteredAt: transition.becameMastered ? now : null,
      lastSeenAt: now,
    });
  }

  // Analytics events. tierBefore/tierAfter в legacy-enum analytics-сервиса —
  // пишем строкой, маппим pool→encounter / mastered→review для совместимости с
  // existing learning_tier enum (учитывается только в analytics, не в логике).
  await recordEvent({
    userId,
    eventType: skip ? 'question_skipped' : 'question_answered',
    wordId,
    tierBefore: (tierBefore),
    tierAfter: (transition.tier),
    questionType: questionType ?? null,
    isCorrect: isCorrect ?? null,
    answerTimeMs: answerTimeMs ?? null,
    payload: grade ? { grade } : null,
  });
  if (transition.wasAdvanced) {
    await recordEvent({
      userId, eventType: 'tier_advanced', wordId,
      tierBefore: (tierBefore),
      tierAfter: (transition.tier),
    });
    // Дневной лимит: считаем переход active → review. Откат L3→L2 через
    // grade='again' идёт другой веткой (wasReset, не wasAdvanced) — счётчик
    // НЕ инкрементируется. См. [[project-learning-v2-redesign]].
    if (tierBefore === 'active' && transition.tier === 'review') {
      await incrementDailyPromotions(userId);
    }
  }
  if (transition.wasReset) {
    await recordEvent({
      userId, eventType: 'tier_reset', wordId,
      tierBefore: (tierBefore),
      tierAfter: (transition.tier),
    });
  }
  if (transition.becameMastered) {
    await recordEvent({
      userId, eventType: 'meaning_learned', wordId,
      tierBefore: (tierBefore),
      tierAfter: (transition.tier),
    });
  }

  return {
    tierBefore,
    tierAfter: transition.tier,
    wasAdvanced: transition.wasAdvanced,
    wasReset: transition.wasReset,
    becameMastered: transition.becameMastered,
    nextReviewAt: transition.nextReviewAt,
  };
}

// ─── Public API: applyPoolSwipe ─────────────────────────────────────────────

export type ApplyPoolSwipeResult = {
  /** true → maybePromoteBatch на этом свайпе сработал и стартовал батч.
   *  Используется UI для показа экрана «Ты отобрал N слов». */
  batchStarted: boolean;
  /** Размер промоушна (0 если не было). Нужно UI для текста экрана. */
  batchSize: number;
};

/**
 * Свайп на L0 pool-карточке.
 *
 *   know   → tier='known_external' (изъятие, не считается в SRS и daily limit)
 *   learn  → tier='pool', pool_swiped_learn_at=now (маркер для батча); затем
 *            maybePromoteBatch — если pool накопил ≥ minBatchSize → старт батча
 *   snooze → tier='pool', state='pool_snoozed', pool_swiped_learn_at=NULL
 *            (если ранее был свайпнут «Изучаю» — маркер зачищается)
 *
 * Safety: если слово уже в review/mastered (legacy / редкий race) — на learn
 * делаем мягкий откат на L2 active без обнуления reviewStage. На know — изымаем
 * в known_external независимо от текущего тира.
 */
export async function applyPoolSwipe(input: {
  userId: number;
  wordId: number;
  action: PoolSwipeAction;
  snoozeDays?: number;
  /** Опционально: коллекция, для фильтра при maybePromoteBatch после learn. */
  collectionId?: number;
}): Promise<ApplyPoolSwipeResult> {
  const { userId, wordId, action } = input;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(userWordProgressWord)
    .where(and(eq(userWordProgressWord.userId, userId), eq(userWordProgressWord.wordId, wordId)))
    .limit(1);

  if (action === 'know') {
    const fields = {
      learningTier: 'known_external' as const,
      state: 'active' as const,
      tierCorrectCount: 0,
      reviewStage: 0,
      consecutiveEasyOrGood: 0,
      nextReviewAt: null,
      snoozedUntil: null,
      poolSwipedLearnAt: null,
      lastSeenAt: now,
      updatedAt: now,
    };
    if (existing) {
      await db.update(userWordProgressWord).set(fields).where(eq(userWordProgressWord.id, existing.id));
    } else {
      await db.insert(userWordProgressWord).values({ userId, wordId, ...fields });
    }
    await recordEvent({ userId, eventType: 'review_swiped_known', wordId });
    return { batchStarted: false, batchSize: 0 };
  }

  if (action === 'learn') {
    // Safety: если слово уже в review/mastered (не должно происходить — фильтр
    // в ensurePoolFromCollection блокирует подкачку, но в pool оно могло
    // попасть через legacy-данные или прямой SQL), не обнуляем SRS-прогресс.
    // Делаем мягкий откат на L2 active. В батч это слово НЕ попадает — оно
    // уже за пределами pool, продолжает обычную SRS-кривую.
    if (existing && (existing.learningTier === 'review' || existing.learningTier === 'mastered')) {
      await db
        .update(userWordProgressWord)
        .set({
          learningTier: 'active',
          state: 'active',
          tierCorrectCount: 0,
          nextReviewAt: now,
          snoozedUntil: null,
          poolSwipedLearnAt: null,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(userWordProgressWord.id, existing.id));
      await recordEvent({ userId, eventType: 'review_swiped_unknown', wordId, payload: { softRollback: true } });
      return { batchStarted: false, batchSize: 0 };
    }

    // Обычный путь: ставим маркер, остаёмся в pool. Промоушн происходит
    // отдельным шагом через maybePromoteBatch.
    const fields = {
      learningTier: 'pool' as const,
      state: 'active' as const,
      tierCorrectCount: 0,
      reviewStage: 0,
      consecutiveEasyOrGood: 0,
      nextReviewAt: now,
      snoozedUntil: null,
      poolSwipedLearnAt: now,
      lastSeenAt: now,
      updatedAt: now,
    };
    if (existing) {
      await db.update(userWordProgressWord).set(fields).where(eq(userWordProgressWord.id, existing.id));
    } else {
      await db.insert(userWordProgressWord).values({ userId, wordId, ...fields });
    }
    await recordEvent({ userId, eventType: 'review_swiped_unknown', wordId });

    // Триггерим попытку промоушна. Если pool накопился до batchSize и daily
    // < limit — стартует батч, UI покажет экран «Ты отобрал N слов».
    const result = await maybePromoteBatch(userId, input.collectionId);
    return { batchStarted: result.promoted > 0, batchSize: result.promoted };
  }

  // snooze
  const baseDays = input.snoozeDays ?? learningConfig.poolSnoozeDaysDefault;
  const jitter = learningConfig.poolSnoozeJitterDays;
  const days = Math.max(1, baseDays + (Math.floor(Math.random() * (2 * jitter + 1)) - jitter));
  const snoozedUntil = addDays(now, days);

  const fields = {
    learningTier: 'pool' as const,
    state: 'pool_snoozed' as const,
    tierCorrectCount: 0,
    snoozedUntil,
    poolSwipedLearnAt: null,
    lastSeenAt: now,
    updatedAt: now,
  };
  if (existing) {
    await db.update(userWordProgressWord).set(fields).where(eq(userWordProgressWord.id, existing.id));
  } else {
    await db.insert(userWordProgressWord).values({ userId, wordId, ...fields });
  }
  await recordEvent({ userId, eventType: 'review_swiped_snooze', wordId, payload: { snoozeDays: days } });
  return { batchStarted: false, batchSize: 0 };
}

// ─── Pool source: ensure new collection words в pool ────────────────────────

/**
 * Подкачка новых слов коллекции в L0 pool. Для каждого word_id из коллекции,
 * у которого ещё нет записи user_word_progress_word (или есть, но без
 * learningTier) — создаём запись tier='pool'.
 *
 * Если у юзера нет активной коллекции — функция no-op.
 *
 * Для user-коллекций добавление слова через input должно идти **в L1 passive**
 * (по спеке: «Для пользовательской: слова только что добавленные через input,
 * идут сразу в L1»). Эта функция — только для готовых системных коллекций.
 *
 * Параметр `limit` ограничивает сколько слов подкачиваем за раз — чтобы
 * избежать explosion'а при больших коллекциях. Pool наполняется лениво.
 */
export async function ensurePoolFromCollection(
  userId: number,
  collectionId: number,
  limit = 20,
): Promise<number> {
  const now = new Date();

  // Слова коллекции без записи в user_word_progress_word.
  //
  // Фикс edge-case: слова с existing review/mastered прогрессом в pool НЕ подкачиваем.
  // Инвариант: «слово в pool ⇒ нет review-истории у пользователя». Это закрывает
  // сценарий «удалил готовую коллекцию → пересоздал → потерял SRS-прогресс».
  // Если запись существует и tier_v2 ∈ {review, mastered} — пропускаем (она
  // продолжит обслуживаться по своему расписанию через pickNext review-слот).
  // ВАЖНО: те же фильтры что в pickRepresentativeMeaning (eligible-фильтр +
  // NON_FUNCTIONAL_SQL для отсева служебных слов: the, and, a, of, to, предлоги
  // и т.д.). Иначе служебные слова попадают в pool, но генератор отказывается
  // их обрабатывать → клиент получает session_complete вместо карточки.
  const rows = await db.execute(sql`
    SELECT DISTINCT wm.word_id AS word_id
    FROM collection_words cw
    JOIN word_meanings wm ON wm.id = cw.meaning_id
    JOIN words w ON w.id = wm.word_id
    LEFT JOIN user_word_progress_word uwpw
      ON uwpw.word_id = wm.word_id AND uwpw.user_id = ${userId}
    WHERE cw.collection_id = ${collectionId}
      AND (uwpw.id IS NULL OR uwpw.learning_tier IS NULL)
      AND (uwpw.learning_tier IS NULL
           OR uwpw.learning_tier NOT IN ('review', 'mastered', 'known_external'))
      AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
      AND ${NON_FUNCTIONAL_SQL}
    LIMIT ${limit}
  `);
  const wordIds = (rows as unknown as { rows: Array<{ word_id: number }> }).rows
    .map((r) => Number(r.word_id))
    .filter((n) => Number.isFinite(n));

  if (wordIds.length === 0) return 0;

  // upsert: если запись есть (legacy без v2) — UPDATE v2-полей; иначе INSERT.
  for (const wordId of wordIds) {
    await db.execute(sql`
      INSERT INTO user_word_progress_word (
        user_id, word_id,
        learning_tier, state, tier_correct_count,
        review_stage, consecutive_easy_or_good,
        next_review_at, last_seen_at, created_at, updated_at
      ) VALUES (
        ${userId}, ${wordId},
        'pool', 'active', 0,
        0, 0,
        ${now}, ${now}, ${now}, ${now}
      )
      ON CONFLICT (user_id, word_id) DO UPDATE
        SET learning_tier = 'pool',
            state = 'active',
            tier_correct_count = 0,
            review_stage = 0,
            consecutive_easy_or_good = 0,
            next_review_at = ${now},
            updated_at = ${now}
        WHERE user_word_progress_word.learning_tier IS NULL
    `);
  }

  return wordIds.length;
}

// ─── Batch promotion: Pool → Passive ───────────────────────────────────────

export type PromoteBatchResult = {
  /** Сколько слов промоутнули. 0 = батч не запустился. */
  promoted: number;
  /** Если promoted=0 — конкретная причина. */
  reason?: 'pool_below_min' | 'daily_limit_reached';
};

/**
 * Чистая функция выбора размера батча (вынесена для unit-теста).
 *
 * Параметры:
 *   eligibleCount   — сколько pool-слов готово к промоушну
 *   dailyCount      — текущий dailyPromotionsCount
 *
 * Возвращает:
 *   PromoteBatchDecision — что делать (skip, promote N) и почему
 */
export type PromoteBatchDecision =
  | { decision: 'skip'; reason: 'pool_below_min' | 'daily_limit_reached' }
  | { decision: 'promote'; size: number };

export function computeBatchSize(eligibleCount: number, dailyCount: number): PromoteBatchDecision {
  if (dailyCount >= learningConfig.dailyPromotionLimit) {
    return { decision: 'skip', reason: 'daily_limit_reached' };
  }
  const normalSize = Math.min(eligibleCount, learningConfig.learningBatchSize);
  if (normalSize < learningConfig.minBatchSize) {
    return { decision: 'skip', reason: 'pool_below_min' };
  }
  const remainingToLimit = learningConfig.dailyPromotionLimit - dailyCount;
  // Soft-overflow: при daily=8, remaining=2, minBatchSize=3 → берём 3,
  // итого за день 11. Юзер всё равно учится осмысленным батчем.
  const size = Math.max(Math.min(normalSize, remainingToLimit), learningConfig.minBatchSize);
  return { decision: 'promote', size };
}

/**
 * Атомарно проверяет можно ли стартовать новый батч изучения и делает
 * промоушн pool → passive если можно. Идемпотентна: можно вызывать на
 * каждом swipe и на каждом pickNext, конкурентность защищена FOR UPDATE
 * SKIP LOCKED на выбираемых строках.
 *
 * Размер батча:
 *   normalSize = min(eligibleCount, learningBatchSize)
 *   if normalSize < minBatchSize → не стартуем
 *   remainingToLimit = dailyPromotionLimit - dailyCount
 *   size = max(min(normalSize, remainingToLimit), minBatchSize)
 *     где «max(..., minBatchSize)» даёт допуск превышения лимита когда
 *     остаток до лимита меньше минимума (см. спеку «daily=8 → батч 4»).
 *
 * Eligibility слов:
 *   tier='pool', state='active', pool_swiped_learn_at IS NOT NULL,
 *   опционально фильтр по collection_id. Сортировка по pool_swiped_learn_at
 *   ASC (старшие свайпы первыми).
 *
 * После промоушна слова получают:
 *   tier='passive', tier_correct_count=0, last_seen_at=NULL (попадают
 *   первыми в pickNext), pool_swiped_learn_at=NULL.
 */
export async function maybePromoteBatch(
  userId: number,
  collectionId?: number,
): Promise<PromoteBatchResult> {
  const dailyCount = await getDailyPromotionsCount(userId);

  // Считаем eligible-слова. Фильтр по коллекции — через подзапрос
  // collection_words → word_meanings.word_id.
  const collectionJoin = collectionId !== undefined
    ? sql`AND uwpw.word_id IN (
        SELECT DISTINCT wm.word_id FROM word_meanings wm
        INNER JOIN collection_words cw ON cw.meaning_id = wm.id
        WHERE cw.collection_id = ${collectionId}
      )`
    : sql``;

  const eligibleRows = (await db.execute(sql`
    SELECT uwpw.id, uwpw.word_id, uwpw.pool_swiped_learn_at
    FROM user_word_progress_word uwpw
    WHERE uwpw.user_id = ${userId}
      AND uwpw.learning_tier = 'pool'
      AND uwpw.state = 'active'
      AND uwpw.pool_swiped_learn_at IS NOT NULL
      ${collectionJoin}
    ORDER BY uwpw.pool_swiped_learn_at ASC
    LIMIT ${learningConfig.learningBatchSize}
  `)) as unknown as { rows: Array<{ id: number; word_id: number }> };

  const decision = computeBatchSize(eligibleRows.rows.length, dailyCount);
  if (decision.decision === 'skip') {
    return { promoted: 0, reason: decision.reason };
  }

  const idsToPromote = eligibleRows.rows.slice(0, decision.size).map((r) => r.id);
  if (idsToPromote.length === 0) {
    return { promoted: 0, reason: 'pool_below_min' };
  }

  const now = new Date();
  // last_seen_at: ставим эпоху (1970-01-01), чтобы свежепромученные слова
  // оказались первыми в pickNext (сортировка `last_seen_at ASC NULLS FIRST`).
  // NULL нельзя — колонка NOT NULL по схеме.
  const epoch = new Date(0);
  await db.execute(sql`
    UPDATE user_word_progress_word
    SET learning_tier = 'passive',
        tier_correct_count = 0,
        last_seen_at = ${epoch},
        pool_swiped_learn_at = NULL,
        updated_at = ${now}
    WHERE id IN (${sql.join(idsToPromote.map((id) => sql`${id}`), sql`, `)})
  `);

  return { promoted: idsToPromote.length };
}

// ─── pickNext: жёсткая лестница приоритетов ───────────────────────────────

export type SessionCompleteReason =
  /** Все слова в обучении есть, но в SRS-cooldown до nextDueAt. */
  | 'all_in_cooldown'
  /** Pool пуст, новых слов в коллекции нет, есть слова на review/snoozed. */
  | 'collection_exhausted'
  /** У юзера вообще нет ни одной learning-записи (свежий аккаунт, нет коллекций). */
  | 'no_words'
  /** Дневной лимит изучения исчерпан, новых батчей не будет до сброса (02:00 MSK). */
  | 'daily_limit_done'
  /** Anti-repeat excludeWordIds накрыл всё что было доступно
   *  (теоретически невозможно при cap=3, но защитный case). */
  | 'all_recent';

export type DailyPromotionsInfo = {
  /** Сколько слов уже перешло active → review за текущий учебный день. */
  count: number;
  /** Максимум, после которого batches не стартуют. */
  limit: number;
};

export type NextPick =
  | {
      kind: 'word';
      wordId: number;
      tier: LearningTier;
      /** Текущее состояние счётчика. Возвращается в каждом ответе для UI. */
      dailyPromotions: DailyPromotionsInfo;
      /** true → на этом pickNext maybePromoteBatch стартовал батч. UI показывает
       *  экран «Ты отобрал N слов» перед первым passive-вопросом. */
      batchStarted?: boolean;
      /** Размер стартовавшего батча. Релевантно только когда batchStarted=true. */
      batchSize?: number;
    }
  | {
      kind: 'session_complete';
      reason: SessionCompleteReason;
      /** Время ближайшего due-слова (для UI «возвращайтесь к …»). null = нет due. */
      nextDueAt: Date | null;
      /** Счётчики для UI: сколько слов на каждом тире (для прозрачности юзеру). */
      counts: {
        pool: number;
        passive: number;
        active: number;
        review: number;
        mastered: number;
      };
      dailyPromotions: DailyPromotionsInfo;
    };

/**
 * Жёсткая лестница приоритетов:
 *   1. L3 review due  (nextReviewAt <= now)
 *   2. L2 active
 *   3. L1 passive
 *   4. ленивый batch: maybePromoteBatch → если стартовал, retry passive
 *   5. L0 pool       (только unmarked, исключая pool_snoozed с snoozedUntil > now)
 *   6. подкачка новых слов коллекции в L0 → retry
 *   7. session_complete
 *
 * Внутри одного приоритета — шафл (LIMIT 5 → random pick один из топа).
 */
export async function pickNext(
  userId: number,
  opts: { collectionId?: number; excludeWordIds?: number[] } = {},
): Promise<NextPick> {
  const excludeWordIds = opts.excludeWordIds ?? [];
  const t0 = Date.now();
  const log = (msg: string, extra?: Record<string, unknown>) => {
    const dt = `${Date.now() - t0}ms`.padStart(6);
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const ex = excludeWordIds.length ? `ex=[${excludeWordIds.join(',')}]` : 'ex=∅';
    const extras = extra ? ` ${Object.entries(extra).map(([k, v]) => `${k}=${v}`).join(' ')}` : '';
    console.log(`[${time}] [v2/next u=${userId} c=${opts.collectionId ?? '∅'} ${ex} ${dt}] ${msg}${extras}`);
  };

  // Daily promotions count нужен в ответе всегда — собираем заранее.
  const dailyCount = await getDailyPromotionsCount(userId);
  const dailyPromotions: DailyPromotionsInfo = {
    count: dailyCount,
    limit: learningConfig.dailyPromotionLimit,
  };

  // 1. L3 review due
  const reviewPick = await tryPickTier(userId, 'review', {
    requireDue: true,
    excludeWordIds,
    collectionId: opts.collectionId,
  });
  if (reviewPick) { log(`→ review wordId=${reviewPick}`); return { kind: 'word', wordId: reviewPick, tier: 'review', dailyPromotions }; }

  // 2. L2 active
  const activePick = await tryPickTier(userId, 'active', { excludeWordIds, collectionId: opts.collectionId });
  if (activePick) { log(`→ active wordId=${activePick}`); return { kind: 'word', wordId: activePick, tier: 'active', dailyPromotions }; }

  // 3. L1 passive
  const passivePick = await tryPickTier(userId, 'passive', { excludeWordIds, collectionId: opts.collectionId });
  if (passivePick) { log(`→ passive wordId=${passivePick}`); return { kind: 'word', wordId: passivePick, tier: 'passive', dailyPromotions }; }

  // 4. Ленивый промоушн pool → passive. Сработает если в pool накопилось
  //    ≥ minBatchSize свайпнутых «Изучаю» и daily<limit.
  const batchResult = await maybePromoteBatch(userId, opts.collectionId);
  if (batchResult.promoted > 0) {
    // Свежезапромученные слова сейчас в passive с last_seen_at=NULL → они
    // попадут первыми в выборку. Обновляем dailyPromotions свежим значением
    // (не должно измениться: maybePromoteBatch не инкрементирует).
    const retryPick = await tryPickTier(userId, 'passive', { excludeWordIds, collectionId: opts.collectionId });
    if (retryPick) {
      log(`→ passive (batch +${batchResult.promoted}) wordId=${retryPick}`);
      return {
        kind: 'word',
        wordId: retryPick,
        tier: 'passive',
        dailyPromotions,
        batchStarted: true,
        batchSize: batchResult.promoted,
      };
    }
  }

  // 5. L0 pool (без pool_snoozed; только unmarked = poolSwipedLearnAt IS NULL).
  //    Это «обзор» — разметка свежих слов из коллекции.
  const poolPick = await tryPickTier(userId, 'pool', { excludeWordIds, collectionId: opts.collectionId });
  if (poolPick) { log(`→ pool wordId=${poolPick}`); return { kind: 'word', wordId: poolPick, tier: 'pool', dailyPromotions }; }

  // 6. Подкачка коллекции в L0. Если коллекция исчерпана / нет коллекции —
  //    переходим к session_complete.
  let added = 0;
  if (typeof opts.collectionId === 'number') {
    added = await ensurePoolFromCollection(userId, opts.collectionId);
    if (added > 0) {
      const retry = await tryPickTier(userId, 'pool', { excludeWordIds, collectionId: opts.collectionId });
      if (retry) { log(`→ pool (after refill +${added}) wordId=${retry}`); return { kind: 'word', wordId: retry, tier: 'pool', dailyPromotions }; }
    }
  }

  // 7. session_complete. Определяем reason.
  const counts = await getTierCounts(userId, opts.collectionId);
  let reason: SessionCompleteReason;

  // Anti-repeat reason проверка — приоритетно, как было.
  if (excludeWordIds.length > 0) {
    const anyWithoutExclude =
      (await tryPickTier(userId, 'pool', { excludeWordIds: [], collectionId: opts.collectionId }))
      ?? (await tryPickTier(userId, 'passive', { excludeWordIds: [], collectionId: opts.collectionId }))
      ?? (await tryPickTier(userId, 'active', { excludeWordIds: [], collectionId: opts.collectionId }))
      ?? (await tryPickTier(userId, 'review', { requireDue: true, excludeWordIds: [], collectionId: opts.collectionId }));
    if (anyWithoutExclude) {
      reason = 'all_recent';
      const nextDueAt = await computeNextDueAt(userId, opts.collectionId);
      return { kind: 'session_complete', reason, nextDueAt, counts, dailyPromotions };
    }
  }

  // Если pool накопил свайпнутых «Изучаю», но maybePromoteBatch отказал
  // именно из-за daily_limit_reached — это «daily_limit_done» (юзер свой
  // дневной норматив сегодня выбрал). Иначе обычные reasons.
  const hasMarkedPool = batchResult.reason === 'daily_limit_reached';
  if (hasMarkedPool) {
    reason = 'daily_limit_done';
  } else {
    const totalLearning = counts.pool + counts.passive + counts.active + counts.review;
    if (totalLearning === 0) {
      reason = 'no_words';
    } else if (counts.review > 0 && counts.pool === 0 && counts.passive === 0 && counts.active === 0) {
      // Всё что есть — на review, и оно в cooldown (иначе review-pick сработал бы).
      reason = 'all_in_cooldown';
    } else {
      // Что-то есть на pool/passive/active, но недоступно (snoozed_until > now или
      // коллекция не содержит этих слов). Это «collection_exhausted» в широком смысле.
      reason = 'collection_exhausted';
    }
  }
  const nextDueAt = await computeNextDueAt(userId, opts.collectionId);
  log(`× session_complete reason=${reason} refill=+${added} daily=${dailyCount}/${learningConfig.dailyPromotionLimit} pool=${counts.pool} passive=${counts.passive} active=${counts.active} review=${counts.review} mastered=${counts.mastered}`);
  return { kind: 'session_complete', reason, nextDueAt, counts, dailyPromotions };
}

async function getTierCounts(
  userId: number,
  collectionId?: number,
): Promise<{ pool: number; passive: number; active: number; review: number; mastered: number }> {
  let collectionFilter: SQL | undefined;
  if (collectionId !== undefined) {
    collectionFilter = sql`AND word_id IN (
      SELECT DISTINCT wm.word_id FROM word_meanings wm
      INNER JOIN collection_words cw ON cw.meaning_id = wm.id
      WHERE cw.collection_id = ${collectionId}
    )`;
  }
  const rows = await db.execute(sql`
    SELECT learning_tier AS tier, COUNT(*)::int AS n
    FROM user_word_progress_word
    WHERE user_id = ${userId}
      AND learning_tier IS NOT NULL
      ${collectionFilter ?? sql``}
    GROUP BY learning_tier
  `);
  const result = { pool: 0, passive: 0, active: 0, review: 0, mastered: 0 };
  // Defensive: drizzle node-postgres может вернуть либо { rows: [...] }, либо
  // массив напрямую (зависит от драйвера). Поддержим оба варианта.
  const rowsArray: Array<{ tier: keyof typeof result; n: number }> = Array.isArray(rows)
    ? rows as Array<{ tier: keyof typeof result; n: number }>
    : (rows as unknown as { rows: Array<{ tier: keyof typeof result; n: number }> }).rows ?? [];
  for (const r of rowsArray) {
    if (r.tier in result) result[r.tier] = Number(r.n);
  }
  return result;
}

async function tryPickTier(
  userId: number,
  tier: LearningTier,
  opts: { requireDue?: boolean; excludeWordIds: number[]; collectionId?: number },
): Promise<number | null> {
  const now = new Date();

  let collectionFilter: SQL | undefined;
  if (opts.collectionId !== undefined) {
    collectionFilter = sql`${userWordProgressWord.wordId} IN (
      SELECT DISTINCT ${wordMeanings.wordId}
      FROM ${wordMeanings}
      INNER JOIN collection_words ON collection_words.meaning_id = ${wordMeanings.id}
      WHERE collection_words.collection_id = ${opts.collectionId}
    )`;
  }

  // Сортировка:
  //   review — by next_review_at ASC (давно просроченные впереди)
  //   passive/active/pool — by last_seen_at ASC NULLS FIRST (never-shown / давно)
  const orderClause = tier === 'review'
    ? [sql`${userWordProgressWord.nextReviewAt} ASC NULLS LAST`]
    : [sql`${userWordProgressWord.lastSeenAt} ASC NULLS FIRST`, sql`${userWordProgressWord.id} ASC`];

  const conditions = [
    eq(userWordProgressWord.userId, userId),
    eq(userWordProgressWord.learningTier, tier),
    // State: pool допускает только 'active' (не pool_snoozed)
    eq(userWordProgressWord.state, 'active' as const),
    // Snoozed_until не блокирует если null или просрочен
    or(isNull(userWordProgressWord.snoozedUntil), lte(userWordProgressWord.snoozedUntil, now))!,
  ];

  if (opts.requireDue) {
    conditions.push(lte(userWordProgressWord.nextReviewAt, now));
  }

  // Pool: показываем в обзоре только слова, по которым юзер ещё не свайпнул
  // «Изучаю». Свайпнутые ждут промоушна в батч (см. maybePromoteBatch).
  if (tier === 'pool') {
    conditions.push(isNull(userWordProgressWord.poolSwipedLearnAt));
  }

  if (opts.excludeWordIds.length > 0) {
    conditions.push(
      sql`${userWordProgressWord.wordId} NOT IN (${sql.join(opts.excludeWordIds.map((id) => sql`${id}`), sql`, `)})`,
    );
  }
  if (collectionFilter) {
    conditions.push(collectionFilter);
  }

  // Шафл: берём топ-5 по сортировке, выбираем случайного. Это даёт перемешивание
  // внутри одного приоритета без полного random-сканирования.
  const rows = await db
    .select({ wordId: userWordProgressWord.wordId })
    .from(userWordProgressWord)
    .where(and(...conditions))
    .orderBy(...orderClause)
    .limit(5);

  if (rows.length === 0) return null;
  const pick = rows[Math.floor(Math.random() * rows.length)]!;
  return pick.wordId;
}

async function computeNextDueAt(userId: number, collectionId?: number): Promise<Date | null> {
  let collectionFilter: SQL | undefined;
  if (collectionId !== undefined) {
    collectionFilter = sql`${userWordProgressWord.wordId} IN (
      SELECT DISTINCT ${wordMeanings.wordId}
      FROM ${wordMeanings}
      INNER JOIN collection_words ON collection_words.meaning_id = ${wordMeanings.id}
      WHERE collection_words.collection_id = ${collectionId}
    )`;
  }

  const rows = await db
    .select({ nextReviewAt: userWordProgressWord.nextReviewAt })
    .from(userWordProgressWord)
    .where(and(
      eq(userWordProgressWord.userId, userId),
      // review-due или snoozed pool — оба могут «разморозиться» в будущем.
      // mastered не учитываем (выпущенные не возвращаются).
      or(
        eq(userWordProgressWord.learningTier, 'review'),
        eq(userWordProgressWord.state, 'pool_snoozed'),
      )!,
      sql`${userWordProgressWord.learningTier} != 'mastered'`,
      ...(collectionFilter ? [collectionFilter] : []),
    ))
    .orderBy(sql`COALESCE(${userWordProgressWord.snoozedUntil}, ${userWordProgressWord.nextReviewAt}) ASC NULLS LAST`)
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  return row.nextReviewAt ?? null;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
