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

import { eq, and, sql, isNull, or, lte, inArray, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userWordProgress, userWordProgressWord, collectionWords, wordMeanings, words } from '../db/schema.js';
import { learningConfig, type ExerciseType } from '../config/learning-config.js';
import { recordEvent, type LearningTier } from './analytics-service.js';
import { FUNCTIONAL_POS, FUNCTIONAL_ENGLISH_WORDS } from '../db/word-filters.js';

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
      // Юзер сказал «не знаю» в обзоре — сбрасываем tier на encounter,
      // даже если слово было на passive/active/review. Без этого, например,
      // слово после плейсмент-калибровки (где markLowerLevelWordsAsLearned
      // ставит tier=review) могло бы получить сразу active recall, что
      // противоречит сигналу «не знаю».
      // Counter'ы correct/incorrect сохраняем — это историческая статистика.
      await db
        .update(userWordProgress)
        .set({
          state: 'learning',
          learningTier: 'encounter',
          tierCorrectCount: 0,
          reviewStage: 0,
          hasPenalty: false,
          nextReviewAt: now, // сразу готов к показу
          fromPlacement: false,
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
      ...(collectionFilter ? [collectionFilter] : []),
      ...(exclude.length > 0
        ? [sql`${userWordProgress.meaningId} NOT IN (${sql.join(exclude.map(id => sql`${id}`), sql`, `)})`]
        : []),
    ))
    .orderBy(sql`CASE ${userWordProgress.learningTier}
        WHEN 'review' THEN 0
        WHEN 'production' THEN 1
        WHEN 'active' THEN 2
        WHEN 'passive' THEN 3
        WHEN 'encounter' THEN 4
        ELSE 5 END`,
      sql`${userWordProgress.nextReviewAt} NULLS FIRST`,
    )
    .limit(1);

  const row = results[0];
  if (!row) return null;
  return { meaningId: row.meaningId, tier: row.tier };
}

// ─── Word-level operations (L1-3 + word-review) ─────────────────────────────
//
// Параллельная ветка к meaning-уровневым функциям выше. Используется на
// уровнях encounter/passive/active (L1-3) и для review-фазы на word-level.
// На L4 production переход управляется meaning-уровневыми функциями.
//
// Инвариант (введён здесь, не выполняется в backfill-данных):
//   - word.tier ∈ {encounter, passive, active, production, review}
//   - word.tier == 'production' ⟹ есть meaning-записи с tier='production'
//   - word.tier == 'review' ⟹ все eligible meanings слова на tier='review'

export type RecordWordAnswerInput = {
  userId: number;
  wordId: number;
  isCorrect: boolean;
  questionType?: ExerciseType | string;
  answerTimeMs?: number;
  skip?: boolean;
};

export type RecordWordAnswerResult = {
  tierBefore: LearningTier;
  tierAfter: LearningTier;
  becameLearned: boolean;
  wasReset: boolean;
  nextReviewAt: Date;
  /** true, если слово ушло в L4 production и созданы meaning-записи. */
  enteredProduction: boolean;
};

/**
 * Загружает eligible meanings слова — те, что прошли учебный фильтр
 * (popularity_rank ≤ 3, frequency ≥ 5, кириллический перевод, не functional).
 * Используется при L3→L4 переходе для создания meaning-записей.
 */
async function getEligibleMeaningsForWord(wordId: number): Promise<{ id: number }[]> {
  const rows = await db
    .select({ id: wordMeanings.id })
    .from(wordMeanings)
    .innerJoin(words, eq(words.id, wordMeanings.wordId))
    .where(and(
      eq(wordMeanings.wordId, wordId),
      or(isNull(wordMeanings.popularityRank), lte(wordMeanings.popularityRank, 3))!,
      or(isNull(wordMeanings.frequency), sql`${wordMeanings.frequency} >= 5`)!,
      sql`${wordMeanings.translation} ~ '[а-яА-ЯёЁ]'`,
      or(
        isNull(wordMeanings.translationPartOfSpeech),
        sql`${wordMeanings.translationPartOfSpeech} NOT IN (${sql.join(FUNCTIONAL_POS.map(p => sql`${p}`), sql`, `)})`,
      )!,
      sql`${words.text} NOT IN (${sql.join(FUNCTIONAL_ENGLISH_WORDS.map(w => sql`${w}`), sql`, `)})`,
    ));
  return rows;
}

/**
 * L3 → L4 переход. Вызывается из recordWordAnswer когда слово достигло
 * tier='production' на word-level (т.е. прошло L3 active recall).
 *
 * Что делает:
 *   1. Удаляет stale meaning-записи на tier ∈ {encounter, passive, active}
 *      (это backfill-артефакты от старой архитектуры — больше не нужны)
 *   2. Вставляет meaning-записи на tier='production' для всех eligible
 *      meanings слова. ON CONFLICT DO NOTHING — если запись уже есть
 *      (например, на production+ от прошлой попытки), не трогаем.
 */
async function transitionWordToProduction(userId: number, wordId: number, now: Date): Promise<void> {
  // 1. Удалить stale L1-3 meaning-записи слова.
  await db.execute(sql`
    DELETE FROM user_word_progress
    USING word_meanings wm
    WHERE wm.id = user_word_progress.meaning_id
      AND wm.word_id = ${wordId}
      AND user_word_progress.user_id = ${userId}
      AND user_word_progress.learning_tier IN ('encounter', 'passive', 'active')
  `);

  // 2. Вставить meaning-записи на production для eligible meanings.
  const eligible = await getEligibleMeaningsForWord(wordId);
  for (const m of eligible) {
    await db
      .insert(userWordProgress)
      .values({
        userId,
        meaningId: m.id,
        state: 'learning',
        learningTier: 'production',
        tierCorrectCount: 0,
        nextReviewAt: now,
        lastSeenAt: now,
      })
      .onConflictDoNothing();
  }
}

/**
 * Проверяет, все ли eligible meanings слова достигли tier='review'.
 * Если да — продвигает word-level запись с tier='production' на 'review'.
 *
 * Вызывается из meaning-level recordAnswer когда meaning достигает
 * production → review.
 */
async function promoteWordToReviewIfReady(userId: number, wordId: number, now: Date): Promise<void> {
  const eligible = await getEligibleMeaningsForWord(wordId);
  if (eligible.length === 0) return;

  const meaningIds = eligible.map(m => m.id);
  const rows = await db
    .select({ tier: userWordProgress.learningTier })
    .from(userWordProgress)
    .where(and(
      eq(userWordProgress.userId, userId),
      inArray(userWordProgress.meaningId, meaningIds),
    ));

  // Должны быть записи на ВСЕ eligible meanings (мы их создали при L3→L4)
  // и каждая — на review.
  if (rows.length < meaningIds.length) return;
  const allReview = rows.every(r => r.tier === 'review');
  if (!allReview) return;

  // Промоушн word-уровневой записи: production → review.
  await db
    .update(userWordProgressWord)
    .set({
      learningTier: 'review',
      tierCorrectCount: 0,
      reviewStage: 0,
      nextReviewAt: addDays(now, learningConfig.intervals.reviewIntervalsDays[0]!),
      hasPenalty: false,
      masteredAt: now,
      updatedAt: now,
    })
    .where(and(
      eq(userWordProgressWord.userId, userId),
      eq(userWordProgressWord.wordId, wordId),
      eq(userWordProgressWord.learningTier, 'production'),
    ));

  await recordEvent({
    userId,
    eventType: 'meaning_learned', // переиспользуем enum: «word fully learned»
    wordId,
    tierBefore: 'production',
    tierAfter: 'review',
  });
}

/**
 * Записать ответ на word-level (L1-3 + word-review).
 * Аналог recordAnswer, но оперирует userWordProgressWord и обрабатывает
 * L3→L4 переход.
 */
export async function recordWordAnswer(input: RecordWordAnswerInput): Promise<RecordWordAnswerResult> {
  const { userId, wordId, isCorrect, questionType, answerTimeMs, skip } = input;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(userWordProgressWord)
    .where(and(eq(userWordProgressWord.userId, userId), eq(userWordProgressWord.wordId, wordId)))
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

  // Persist word-level row.
  if (existing) {
    await db
      .update(userWordProgressWord)
      .set({
        learningTier: transition.tier,
        tierCorrectCount: transition.tierCorrectCount,
        reviewStage: transition.reviewStage,
        nextReviewAt: transition.nextReviewAt,
        hasPenalty: transition.hasPenalty,
        masteredAt: transition.becameLearned ? now : existing.masteredAt,
        correctCount: isCorrect ? sql`${userWordProgressWord.correctCount} + 1` : userWordProgressWord.correctCount,
        incorrectCount: !isCorrect ? sql`${userWordProgressWord.incorrectCount} + 1` : userWordProgressWord.incorrectCount,
        fromPlacement: false,
        lastSeenAt: now,
        updatedAt: now,
      })
      .where(eq(userWordProgressWord.id, existing.id));
  } else {
    await db.insert(userWordProgressWord).values({
      userId,
      wordId,
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

  // L3 → L4: создать meaning-записи на production.
  // Это происходит когда tierBefore='active' и transition.tier='production'.
  // computeTransition даёт tier='production' только когда production tier
  // включён в конфиге; иначе сразу 'review'.
  let enteredProduction = false;
  if (tierBefore === 'active' && transition.tier === 'production' && transition.wasAdvanced) {
    await transitionWordToProduction(userId, wordId, now);
    enteredProduction = true;
  }

  // Analytics events.
  await recordEvent({
    userId,
    eventType: skip ? 'question_skipped' : 'question_answered',
    wordId,
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
      wordId,
      tierBefore,
      tierAfter: transition.tier,
    });
  }
  if (transition.wasReset) {
    await recordEvent({
      userId,
      eventType: 'tier_reset',
      wordId,
      tierBefore,
      tierAfter: transition.tier,
    });
  }
  if (transition.becameLearned) {
    await recordEvent({
      userId,
      eventType: 'meaning_learned', // словарный enum, semantically «word learned»
      wordId,
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
    enteredProduction,
  };
}

/**
 * Применить swipe из обзора на уровне Word. Аналогично applySwipe, но в
 * userWordProgressWord (по wordId).
 */
export async function applyWordSwipe(input: { userId: number; wordId: number; action: SwipeAction; snoozeDays?: number }): Promise<void> {
  const { userId, wordId, action } = input;
  const now = new Date();

  const [existing] = await db
    .select()
    .from(userWordProgressWord)
    .where(and(eq(userWordProgressWord.userId, userId), eq(userWordProgressWord.wordId, wordId)))
    .limit(1);

  if (action === 'known') {
    if (existing) {
      await db.update(userWordProgressWord)
        .set({ state: 'known_from_review', snoozedUntil: null, lastSeenAt: now, updatedAt: now })
        .where(eq(userWordProgressWord.id, existing.id));
    } else {
      await db.insert(userWordProgressWord).values({
        userId, wordId, state: 'known_from_review', learningTier: 'encounter',
        tierCorrectCount: 0, lastSeenAt: now,
      });
    }
    await recordEvent({ userId, eventType: 'review_swiped_known', wordId });
    return;
  }

  if (action === 'unknown') {
    if (existing) {
      await db.update(userWordProgressWord)
        .set({
          state: 'pending_pool', learningTier: 'encounter', tierCorrectCount: 0,
          reviewStage: 0, hasPenalty: false, nextReviewAt: now, fromPlacement: false,
          snoozedUntil: null, lastSeenAt: now, updatedAt: now,
        })
        .where(eq(userWordProgressWord.id, existing.id));
    } else {
      await db.insert(userWordProgressWord).values({
        userId, wordId, state: 'pending_pool', learningTier: 'encounter',
        tierCorrectCount: 0, nextReviewAt: now, lastSeenAt: now,
      });
    }
    await recordEvent({ userId, eventType: 'review_swiped_unknown', wordId });
    return;
  }

  // snooze
  const baseDays = input.snoozeDays ?? learningConfig.review.snoozeDaysDefault;
  const jitter = learningConfig.review.snoozeJitterDays;
  const days = baseDays + (Math.floor(Math.random() * (2 * jitter + 1)) - jitter);
  const snoozedUntil = addDays(now, Math.max(1, days));
  if (existing) {
    await db.update(userWordProgressWord)
      .set({ state: 'snoozed', snoozedUntil, lastSeenAt: now, updatedAt: now })
      .where(eq(userWordProgressWord.id, existing.id));
  } else {
    await db.insert(userWordProgressWord).values({
      userId, wordId, state: 'snoozed', snoozedUntil,
      learningTier: 'encounter', tierCorrectCount: 0, lastSeenAt: now,
    });
  }
  await recordEvent({ userId, eventType: 'review_swiped_snooze', wordId, payload: { snoozeDays: days } });
}

/**
 * Откат свайпа на word-level. Удаляет word-progress запись.
 */
export async function undoWordSwipe(
  userId: number,
  wordId: number,
  originalAction?: 'known' | 'unknown' | 'snooze',
): Promise<void> {
  await db
    .delete(userWordProgressWord)
    .where(and(eq(userWordProgressWord.userId, userId), eq(userWordProgressWord.wordId, wordId)));
  await recordEvent({
    userId,
    eventType: 'review_undo',
    wordId,
    payload: originalAction ? { originalAction } : null,
  });
}

/**
 * Word-level pickNextItem. Возвращает word на текущем tier'е (encounter/passive/
 * active/review). Tier='production' игнорируется — это L4 (per-meaning).
 */
export async function pickNextWord(
  userId: number,
  opts: { excludeWordIds?: number[]; collectionId?: number } = {},
): Promise<{ wordId: number; tier: LearningTier } | null> {
  const exclude = opts.excludeWordIds ?? [];
  const now = new Date();

  // Если задан collectionId — ограничиваем пул.
  let collectionFilter: ReturnType<typeof inArray> | null = null;
  if (typeof opts.collectionId === 'number') {
    const meaningIds = await db
      .select({ meaningId: collectionWords.meaningId })
      .from(collectionWords)
      .where(eq(collectionWords.collectionId, opts.collectionId));
    if (meaningIds.length === 0) return null;
    const wordIds = await db
      .select({ wordId: wordMeanings.wordId })
      .from(wordMeanings)
      .where(inArray(wordMeanings.id, meaningIds.map(r => r.meaningId)));
    if (wordIds.length === 0) return null;
    const uniqueWordIds = [...new Set(wordIds.map(r => r.wordId))];
    collectionFilter = inArray(userWordProgressWord.wordId, uniqueWordIds);
  }

  const results = await db
    .select({ wordId: userWordProgressWord.wordId, tier: userWordProgressWord.learningTier })
    .from(userWordProgressWord)
    .where(and(
      eq(userWordProgressWord.userId, userId),
      eq(userWordProgressWord.state, 'learning'),
      // Production-tier на word-уровне игнорируем — handled by meaning-side.
      ne(userWordProgressWord.learningTier, 'production'),
      or(isNull(userWordProgressWord.snoozedUntil), lte(userWordProgressWord.snoozedUntil, now))!,
      or(isNull(userWordProgressWord.nextReviewAt), lte(userWordProgressWord.nextReviewAt, now))!,
      ...(collectionFilter ? [collectionFilter] : []),
      ...(exclude.length > 0
        ? [sql`${userWordProgressWord.wordId} NOT IN (${sql.join(exclude.map(id => sql`${id}`), sql`, `)})`]
        : []),
    ))
    .orderBy(sql`CASE ${userWordProgressWord.learningTier}
        WHEN 'review' THEN 0
        WHEN 'active' THEN 2
        WHEN 'passive' THEN 3
        WHEN 'encounter' THEN 4
        ELSE 5 END`,
      sql`${userWordProgressWord.nextReviewAt} NULLS FIRST`,
    )
    .limit(1);

  const row = results[0];
  if (!row) return null;
  return { wordId: row.wordId, tier: row.tier };
}

// ─── Combined picker: word-level OR meaning-level ───────────────────────────

export type NextPick =
  | { kind: 'word'; wordId: number; tier: LearningTier }
  | { kind: 'meaning'; meaningId: number; tier: LearningTier };

const TIER_PRIORITY: Record<LearningTier, number> = {
  review: 0,
  production: 1,
  active: 2,
  passive: 3,
  encounter: 4,
};

/**
 * Объединённый picker: возвращает либо word (L1-3 + word-review), либо
 * meaning (L4 production + per-meaning rollback). По tier-приоритету.
 *
 * Логика: запрашиваем оба пула, выбираем top-1 из каждого, затем top-1
 * по tier-приоритету.
 */
export async function pickNextItemCombined(
  userId: number,
  opts: { excludeWordIds?: number[]; excludeMeaningIds?: number[]; collectionId?: number } = {},
): Promise<NextPick | null> {
  const wordPick = await pickNextWord(userId, {
    excludeWordIds: opts.excludeWordIds,
    collectionId: opts.collectionId,
  });
  const meaningPick = await pickNextItem(userId, {
    excludeMeaningIds: opts.excludeMeaningIds,
    collectionId: opts.collectionId,
  });

  if (!wordPick && !meaningPick) return null;
  if (!meaningPick) return { kind: 'word', wordId: wordPick!.wordId, tier: wordPick!.tier };
  if (!wordPick) return { kind: 'meaning', meaningId: meaningPick.meaningId, tier: meaningPick.tier };

  // Оба есть — выбираем по tier-приоритету.
  if (TIER_PRIORITY[wordPick.tier] <= TIER_PRIORITY[meaningPick.tier]) {
    return { kind: 'word', wordId: wordPick.wordId, tier: wordPick.tier };
  }
  return { kind: 'meaning', meaningId: meaningPick.meaningId, tier: meaningPick.tier };
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

// ─── Hook for meaning-level recordAnswer: promote word to review ────────────

/**
 * Экспорт для использования из существующего recordAnswer (meaning-level)
 * после успешного перехода production → review одного из meaning'ов.
 *
 * Я не модифицирую существующий recordAnswer чтобы не сломать тесты на
 * чистоту computeTransition. Вместо этого вызывающий код в /api/learning/answer
 * после meaning-level recordAnswer должен сам вызвать promoteWordToReview
 * если recordAnswer вернул becameLearned=true (significant only when tier
 * before was production).
 */
export async function promoteWordToReview(userId: number, wordId: number): Promise<void> {
  await promoteWordToReviewIfReady(userId, wordId, new Date());
}
