/**
 * Learning Service — фундамент новой лестницы освоения слов.
 *
 * Заменяет логику `srs-service.computeNextReview` на tier-машину
 * encounter → passive → active → production → review.
 *
 * В фазе 2 этот сервис существует параллельно `quiz-service.recordInfiniteAnswer`
 * и НЕ интегрирован в API роуты. Интеграция — в фазе 3 (см. план переработки).
 *
 * Ключевые решения (зафиксированы юзером в Этапе 2):
 *   - В фазе изучения (encounter/passive/active) ошибка НЕ откатывает tier,
 *     только сбрасывает tier_correct_count и ставит cooldown 30 минут.
 *   - В review-фазе ошибка откатывает на active (см. learningConfig.intervals).
 *   - Production отключён (enabled=false) — переход active → review.
 *     Когда production включится в фазе 7, новые слова пойдут active → production
 *     → review, существующие записи на review остаются как есть.
 *   - Лестницу пользователь не видит явно — это внутренняя логика отбора.
 */

import { eq, and, sql, isNull, or, lte, ne, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userWordProgress, collectionWords } from '../db/schema.js';
import { learningConfig, type ExerciseType } from '../config/learning-config.js';
import { recordEvent, type LearningTier } from './analytics-service.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type TierTransitionInput = {
  tier: LearningTier;
  tierCorrectCount: number;
  reviewStage: number;
  hasPenalty: boolean;
  isCorrect: boolean;
};

export type TierTransitionResult = {
  /** Новый tier после применения ответа. */
  tier: LearningTier;
  /** Новый счётчик правильных подряд для текущего tier. */
  tierCorrectCount: number;
  /** Новый review_stage. Релевантен только когда tier='review'. */
  reviewStage: number;
  /** Когда показывать слово снова. null = никогда (например, после known_from_review). */
  nextReviewAt: Date;
  /** has_penalty флаг (унаследован из старого SRS — оставлен для совместимости). */
  hasPenalty: boolean;
  /** true, если это переход в review «впервые» (был active, стал review). */
  becameLearned: boolean;
  /** true, если был выполнен откат (review wrong → active). */
  wasReset: boolean;
  /** true, если tier продвинулся вперёд (encounter→passive, passive→active, active→review). */
  wasAdvanced: boolean;
};

export type RecordAnswerInput = {
  userId: number;
  meaningId: number;
  isCorrect: boolean;
  questionType?: ExerciseType | string;
  answerTimeMs?: number;
  /** true, если пользователь нажал «пропустить». Влияет только на аналитику —
   *  пишется event question_skipped, а не question_answered. Tier-машина
   *  обрабатывает skip как обычный wrong (не отдельная ветка). */
  skip?: boolean;
};

export type RecordAnswerResult = {
  tierBefore: LearningTier;
  tierAfter: LearningTier;
  becameLearned: boolean;
  wasReset: boolean;
  nextReviewAt: Date;
};

export type SwipeAction = 'known' | 'unknown' | 'snooze';

export type ApplySwipeInput = {
  userId: number;
  meaningId: number;
  action: SwipeAction;
  /** Кастомный snooze-days. Если не задан — берётся из конфига + jitter. */
  snoozeDays?: number;
};

// ─── Pure tier-machine ──────────────────────────────────────────────────────

/**
 * Чистая функция: на вход — текущее состояние слова, на выход — новое.
 *
 * Не делает БД-запросов, не читает now() — все timestamp'ы относительны
 * `now`. Это удобно для тестов: подаёшь состояние, проверяешь все поля.
 */
export function computeTransition(
  input: TierTransitionInput,
  now: Date = new Date(),
): TierTransitionResult {
  const { tier, tierCorrectCount, reviewStage, isCorrect } = input;
  const cfg = learningConfig.tiers[tier];

  // ─── encounter ────────────────────────────────────────────────────────────
  // Encounter — это просто показ карточки. По плану 1 показ = переход на passive.
  // Корректность ответа не имеет смысла (нет проверки), но защитимся: считаем
  // любой записанный ответ как «карточка показана».
  if (tier === 'encounter') {
    return {
      tier: 'passive',
      tierCorrectCount: 0,
      reviewStage: 0,
      nextReviewAt: addHours(now, learningConfig.intervals.encounterToPassiveHours),
      hasPenalty: false,
      becameLearned: false,
      wasReset: false,
      wasAdvanced: true,
    };
  }

  // ─── passive ──────────────────────────────────────────────────────────────
  if (tier === 'passive') {
    if (!isCorrect) {
      return {
        tier: 'passive',
        tierCorrectCount: 0,
        reviewStage: 0,
        nextReviewAt: addMinutes(now, learningConfig.intervals.learningCooldownMinutes),
        hasPenalty: true,
        becameLearned: false,
        wasReset: false,
        wasAdvanced: false,
      };
    }
    const newCount = tierCorrectCount + 1;
    if (newCount >= cfg.correctToAdvance) {
      return {
        tier: 'active',
        tierCorrectCount: 0,
        reviewStage: 0,
        nextReviewAt: addHours(now, learningConfig.intervals.learningIntervalsHours[0]),
        hasPenalty: false,
        becameLearned: false,
        wasReset: false,
        wasAdvanced: true,
      };
    }
    const intervals = learningConfig.intervals.learningIntervalsHours;
    const idx = Math.min(newCount, intervals.length - 1);
    return {
      tier: 'passive',
      tierCorrectCount: newCount,
      reviewStage: 0,
      nextReviewAt: addHours(now, intervals[idx]!),
      hasPenalty: false,
      becameLearned: false,
      wasReset: false,
      wasAdvanced: false,
    };
  }

  // ─── active ───────────────────────────────────────────────────────────────
  if (tier === 'active') {
    if (!isCorrect) {
      return {
        tier: 'active',
        tierCorrectCount: 0,
        reviewStage: 0,
        nextReviewAt: addMinutes(now, learningConfig.intervals.learningCooldownMinutes),
        hasPenalty: true,
        becameLearned: false,
        wasReset: false,
        wasAdvanced: false,
      };
    }
    const newCount = tierCorrectCount + 1;
    if (newCount >= cfg.correctToAdvance) {
      // active → production (если включён) или сразу → review
      const productionEnabled = learningConfig.tiers.production.enabled;
      if (productionEnabled) {
        return {
          tier: 'production',
          tierCorrectCount: 0,
          reviewStage: 0,
          nextReviewAt: addHours(now, learningConfig.intervals.learningIntervalsHours[0]),
          hasPenalty: false,
          becameLearned: false,
          wasReset: false,
          wasAdvanced: true,
        };
      }
      return {
        tier: 'review',
        tierCorrectCount: 0,
        reviewStage: 0,
        nextReviewAt: addDays(now, learningConfig.intervals.reviewIntervalsDays[0]!),
        hasPenalty: false,
        becameLearned: true,
        wasReset: false,
        wasAdvanced: true,
      };
    }
    const intervals = learningConfig.intervals.learningIntervalsHours;
    const idx = Math.min(newCount, intervals.length - 1);
    return {
      tier: 'active',
      tierCorrectCount: newCount,
      reviewStage: 0,
      nextReviewAt: addHours(now, intervals[idx]!),
      hasPenalty: false,
      becameLearned: false,
      wasReset: false,
      wasAdvanced: false,
    };
  }

  // ─── production ───────────────────────────────────────────────────────────
  if (tier === 'production') {
    if (!isCorrect) {
      return {
        tier: 'production',
        tierCorrectCount: 0,
        reviewStage: 0,
        nextReviewAt: addMinutes(now, learningConfig.intervals.learningCooldownMinutes),
        hasPenalty: true,
        becameLearned: false,
        wasReset: false,
        wasAdvanced: false,
      };
    }
    const newCount = tierCorrectCount + 1;
    if (newCount >= cfg.correctToAdvance) {
      return {
        tier: 'review',
        tierCorrectCount: 0,
        reviewStage: 0,
        nextReviewAt: addDays(now, learningConfig.intervals.reviewIntervalsDays[0]!),
        hasPenalty: false,
        becameLearned: true,
        wasReset: false,
        wasAdvanced: true,
      };
    }
    const intervals = learningConfig.intervals.learningIntervalsHours;
    const idx = Math.min(newCount, intervals.length - 1);
    return {
      tier: 'production',
      tierCorrectCount: newCount,
      reviewStage: 0,
      nextReviewAt: addHours(now, intervals[idx]!),
      hasPenalty: false,
      becameLearned: false,
      wasReset: false,
      wasAdvanced: false,
    };
  }

  // ─── review ───────────────────────────────────────────────────────────────
  // tier === 'review'
  if (!isCorrect) {
    // Откат на active с кулдауном.
    return {
      tier: learningConfig.intervals.reviewWrongRollbackTier,
      tierCorrectCount: 0,
      reviewStage: 0,
      nextReviewAt: addDays(now, learningConfig.intervals.reviewWrongCooldownDays),
      hasPenalty: false,
      becameLearned: false,
      wasReset: true,
      wasAdvanced: false,
    };
  }
  const intervals = learningConfig.intervals.reviewIntervalsDays;
  const nextStage = Math.min(reviewStage + 1, intervals.length - 1);
  const intervalDays = intervals[nextStage]!;
  return {
    tier: 'review',
    tierCorrectCount: 0,
    reviewStage: nextStage,
    nextReviewAt: addDays(now, intervalDays),
    hasPenalty: false,
    becameLearned: false,
    wasReset: false,
    wasAdvanced: false,
  };
}

// ─── Public API: recordAnswer ───────────────────────────────────────────────

/**
 * Записать ответ пользователя на слово, провести его по tier-машине,
 * сохранить новое состояние и записать аналитические события.
 *
 * Кастомные слова (meaningId < 0) НЕ обрабатываются здесь — для них
 * остаётся отдельный pathway в quiz-service. Будет переработано в фазе 3.
 */
export async function recordAnswer(input: RecordAnswerInput): Promise<RecordAnswerResult> {
  const { userId, meaningId, isCorrect, questionType, answerTimeMs, skip } = input;
  const now = new Date();

  // Загружаем текущий прогресс или создаём новую запись.
  const [existing] = await db
    .select()
    .from(userWordProgress)
    .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.meaningId, meaningId)))
    .limit(1);

  const tierBefore: LearningTier = existing?.learningTier ?? 'encounter';
  const tierCorrectCountBefore = existing?.tierCorrectCount ?? 0;
  const reviewStageBefore = existing?.reviewStage ?? 0;
  const hasPenaltyBefore = existing?.hasPenalty ?? false;

  const transition = computeTransition({
    tier: tierBefore,
    tierCorrectCount: tierCorrectCountBefore,
    reviewStage: reviewStageBefore,
    hasPenalty: hasPenaltyBefore,
    isCorrect,
  }, now);

  // Persist.
  if (existing) {
    await db
      .update(userWordProgress)
      .set({
        learningTier: transition.tier,
        tierCorrectCount: transition.tierCorrectCount,
        reviewStage: transition.reviewStage,
        nextReviewAt: transition.nextReviewAt,
        hasPenalty: transition.hasPenalty,
        masteredAt: transition.becameLearned ? now : existing.masteredAt,
        correctCount: isCorrect
          ? sql`${userWordProgress.correctCount} + 1`
          : userWordProgress.correctCount,
        incorrectCount: !isCorrect
          ? sql`${userWordProgress.incorrectCount} + 1`
          : userWordProgress.incorrectCount,
        // state не трогаем — остаётся 'learning' (изменяется только через applySwipe).
        fromPlacement: false, // реальный ответ → сбрасываем флаг плейсмента
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(userWordProgress.id, existing.id));
  } else {
    await db.insert(userWordProgress).values({
      userId,
      meaningId,
      state: 'learning',
      learningTier: transition.tier,
      tierCorrectCount: transition.tierCorrectCount,
      reviewStage: transition.reviewStage,
      nextReviewAt: transition.nextReviewAt,
      hasPenalty: transition.hasPenalty,
      masteredAt: transition.becameLearned ? now : null,
      correctCount: isCorrect ? 1 : 0,
      incorrectCount: isCorrect ? 0 : 1,
      lastSeenAt: now,
    });
  }

  // Analytics: question_answered (или question_skipped) + tier_advanced/tier_reset/meaning_learned.
  await recordEvent({
    userId,
    eventType: skip ? 'question_skipped' : 'question_answered',
    meaningId,
    tierBefore,
    tierAfter: transition.tier,
    questionType: questionType ?? null,
    isCorrect,
    answerTimeMs: answerTimeMs ?? null,
  });

  if (transition.wasAdvanced) {
    await recordEvent({
      userId,
      eventType: 'tier_advanced',
      meaningId,
      tierBefore,
      tierAfter: transition.tier,
    });
  }
  if (transition.wasReset) {
    await recordEvent({
      userId,
      eventType: 'tier_reset',
      meaningId,
      tierBefore,
      tierAfter: transition.tier,
    });
  }
  if (transition.becameLearned) {
    await recordEvent({
      userId,
      eventType: 'meaning_learned',
      meaningId,
      tierBefore,
      tierAfter: transition.tier,
    });
  }

  return {
    tierBefore,
    tierAfter: transition.tier,
    becameLearned: transition.becameLearned,
    wasReset: transition.wasReset,
    nextReviewAt: transition.nextReviewAt,
  };
}

// ─── Public API: applySwipe ─────────────────────────────────────────────────

/**
 * Применить свайп из обзора. Не идёт через tier-машину — это прямое
 * действие пользователя над состоянием слова.
 *
 *   known   → state='known_from_review', не учим.
 *   unknown → state='learning', tier='encounter', сразу в очередь обучения.
 *   snooze  → state='snoozed', snoozedUntil=now+N±jitter дней.
 */
export async function applySwipe(input: ApplySwipeInput): Promise<void> {
  const { userId, meaningId, action } = input;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(userWordProgress)
    .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.meaningId, meaningId)))
    .limit(1);

  if (action === 'known') {
    if (existing) {
      await db
        .update(userWordProgress)
        .set({
          state: 'known_from_review',
          snoozedUntil: null,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(userWordProgress.id, existing.id));
    } else {
      await db.insert(userWordProgress).values({
        userId,
        meaningId,
        state: 'known_from_review',
        learningTier: 'encounter', // не используется при known_from_review
        tierCorrectCount: 0,
        lastSeenAt: now,
      });
    }
    await recordEvent({
      userId,
      eventType: 'review_swiped_known',
      meaningId,
    });
    return;
  }

  if (action === 'unknown') {
    if (existing) {
      // Если уже учили — оставляем текущий прогресс. Свайп «не знаю» в обзоре
      // на уже изучаемом слове = шумный сигнал, не перезаписываем.
      // Только меняем state→learning и снимаем snooze, если был.
      await db
        .update(userWordProgress)
        .set({
          state: 'learning',
          snoozedUntil: null,
          lastSeenAt: now,
          updatedAt: now,
        })
        .where(eq(userWordProgress.id, existing.id));
    } else {
      await db.insert(userWordProgress).values({
        userId,
        meaningId,
        state: 'learning',
        learningTier: 'encounter',
        tierCorrectCount: 0,
        nextReviewAt: now, // сразу готов к показу
        lastSeenAt: now,
      });
    }
    await recordEvent({
      userId,
      eventType: 'review_swiped_unknown',
      meaningId,
    });
    return;
  }

  // action === 'snooze'
  const baseDays = input.snoozeDays ?? learningConfig.review.snoozeDaysDefault;
  const jitter = learningConfig.review.snoozeJitterDays;
  const days = baseDays + (Math.floor(Math.random() * (2 * jitter + 1)) - jitter);
  const snoozedUntil = addDays(now, Math.max(1, days));

  if (existing) {
    await db
      .update(userWordProgress)
      .set({
        state: 'snoozed',
        snoozedUntil,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(userWordProgress.id, existing.id));
  } else {
    await db.insert(userWordProgress).values({
      userId,
      meaningId,
      state: 'snoozed',
      snoozedUntil,
      learningTier: 'encounter',
      tierCorrectCount: 0,
      lastSeenAt: now,
    });
  }
  await recordEvent({
    userId,
    eventType: 'review_swiped_snooze',
    meaningId,
    payload: { snoozeDays: days },
  });
}

/**
 * Откат свайпа. Удаляет запись `user_word_progress` для пары (userId, meaningId),
 * чтобы слово снова появилось в feed обзора. Используется жестом «вниз» в режиме A.
 *
 * Если записи не было — no-op (не падаем).
 *
 * `originalAction` — что именно откатывают (для аналитики). Клиент знает по
 * своей history, поэтому передаёт; сервер сам не определяет (последнее
 * событие в learning_events может быть question_shown между свайпами).
 */
export async function undoSwipe(
  userId: number,
  meaningId: number,
  originalAction?: 'known' | 'unknown' | 'snooze',
): Promise<void> {
  await db
    .delete(userWordProgress)
    .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.meaningId, meaningId)));

  await recordEvent({
    userId,
    eventType: 'review_undo',
    meaningId,
    payload: originalAction ? { originalAction } : null,
  });
}

// ─── Public API: pickNextItem (минимальная версия для фазы 2) ───────────────

/**
 * Выбрать следующее слово для показа.
 *
 * Это упрощённая реализация: подбираем по приоритету review > active > passive
 * > encounter, с учётом state и snoozed_until. В фазе 3 переработается под
 * учёт generator-rotation, adaptive difficulty и пулов коллекций.
 */
export async function pickNextItem(
  userId: number,
  opts: { excludeMeaningIds?: number[]; collectionId?: number } = {},
): Promise<{ meaningId: number; tier: LearningTier } | null> {
  const exclude = opts.excludeMeaningIds ?? [];
  const now = new Date();

  // Если задан collectionId — ограничиваем пул meanings из этой коллекции.
  let collectionFilter: ReturnType<typeof inArray> | null = null;
  if (typeof opts.collectionId === 'number') {
    const meaningIds = await db
      .select({ meaningId: collectionWords.meaningId })
      .from(collectionWords)
      .where(eq(collectionWords.collectionId, opts.collectionId));
    if (meaningIds.length === 0) return null;
    collectionFilter = inArray(userWordProgress.meaningId, meaningIds.map(r => r.meaningId));
  }

  // Берём 1 строку: подходящие записи, отсортированные по tier-приоритету и nextReviewAt.
  // tier_priority: review=0, active=1, production=2, passive=3, encounter=4.
  const results = await db
    .select({
      meaningId: userWordProgress.meaningId,
      tier: userWordProgress.learningTier,
    })
    .from(userWordProgress)
    .where(and(
      eq(userWordProgress.userId, userId),
      eq(userWordProgress.state, 'learning'),
      or(
        isNull(userWordProgress.snoozedUntil),
        lte(userWordProgress.snoozedUntil, now),
      )!,
      or(
        isNull(userWordProgress.nextReviewAt),
        lte(userWordProgress.nextReviewAt, now),
      )!,
      // production отключён — пропускаем.
      ne(userWordProgress.learningTier, 'production'),
      ...(collectionFilter ? [collectionFilter] : []),
      ...(exclude.length > 0
        ? [sql`${userWordProgress.meaningId} NOT IN (${sql.join(exclude.map(id => sql`${id}`), sql`, `)})`]
        : []),
    ))
    .orderBy(sql`CASE ${userWordProgress.learningTier}
        WHEN 'review' THEN 0
        WHEN 'active' THEN 1
        WHEN 'passive' THEN 2
        WHEN 'encounter' THEN 3
        ELSE 4 END`,
      sql`${userWordProgress.nextReviewAt} NULLS FIRST`,
    )
    .limit(1);

  const row = results[0];
  if (!row) return null;
  return { meaningId: row.meaningId, tier: row.tier };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60 * 1000);
}
function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 60 * 60 * 1000);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
}
