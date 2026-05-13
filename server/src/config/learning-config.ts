/**
 * Конфигурация лестницы освоения слова.
 *
 *   L0 pool     — слово ждёт первой разметки в обзоре (Знаю / Изучаю / Отложить)
 *   L1 passive  — узнавание: «Не помню / 👁 / Помню». N правильных подряд → L2
 *   L2 active   — свободный ввод ru→en. N правильных подряд → L3
 *   L3 review   — SRS с сеткой [1,3,7,14,30,90,180,365] + кнопки Снова/Трудно/Хорошо/Легко
 *   mastered    — выпущен из обучения (после двух подряд good/easy на финальном stage)
 *
 * SM-2 без EF в первой итерации: только сетка + модификаторы кнопок.
 * Поле ef_factor в БД остаётся (default 2.50, не используется в формуле).
 */

import type { LearningTier } from '../services/analytics-service.js';

// Типы упражнений, разрешённые на каждом тире.
export type ExerciseType =
  | 'pool-card'
  | 'passive-recall-card'
  | 'free-recall';

export type TierConfig = {
  /** Сколько правильных подряд для перехода на следующий tier.
   *  На L0 не используется (свайп). На L3 не используется (SM-2 через grade). */
  correctToAdvance: number;
  /** Какие упражнения разрешены на тире. */
  allowedExerciseTypes: readonly ExerciseType[];
};

export const learningConfig = {
  tiers: {
    pool: {
      // L0 — свайп-карточка. Кнопки «Знаю / Изучаю / Отложить».
      correctToAdvance: 0,
      allowedExerciseTypes: ['pool-card'] as const,
    },
    passive: {
      // L1 — узнавание. 1 «Помню» → L2 (по текущей пилотной настройке).
      correctToAdvance: 1,
      allowedExerciseTypes: ['passive-recall-card'] as const,
    },
    active: {
      // L2 — свободный ввод ru→en. 2 правильных подряд → L3.
      correctToAdvance: 2,
      allowedExerciseTypes: ['free-recall'] as const,
    },
    review: {
      // L3 — SRS, ввод + 4 кнопки grade. correctToAdvance не используется.
      correctToAdvance: 0,
      allowedExerciseTypes: ['free-recall'] as const,
    },
    mastered: {
      // Выпущен из обучения. Не показывается в pickNext.
      correctToAdvance: 0,
      allowedExerciseTypes: [] as const,
    },
    known_external: {
      // Свайпнуто «Знаю» в обзоре. Изъято из учебного потока.
      // В UI коллекции отображается как mastered (полный ринг). Не идёт
      // в SRS и не считается в daily_promotions_count.
      correctToAdvance: 0,
      allowedExerciseTypes: [] as const,
    },
  } satisfies Record<LearningTier, TierConfig>,

  // SM-2 сетка интервалов в днях. Индекс = reviewStage.
  reviewGrid: [1, 3, 7, 14, 30, 90, 180, 365] as const,

  // Модификаторы кнопок grade на L3.
  reviewGradeModifiers: {
    again: null,    // откат на L2, не интервал
    hard: 1.2,
    good: 1.0,
    easy: 1.5,
  } as const,

  // Сколько подряд good/easy на финальном stage нужно для выпуска в mastered.
  reviewMasteredAfter: 2,

  // L0 «Отложить»: на сколько дней слово уходит в pool_snoozed.
  poolSnoozeDaysDefault: 7,
  poolSnoozeJitterDays: 2,

  // Anti-repeat: сколько последних wordId клиент шлёт в excludeWordIds.
  recentWordIdsWindow: 3,

  // ─── Дневной лимит изучения ──────────────────────────────────────────────
  /** Сколько слов за день максимум переходит active → review.
   *  Soft limit: новые батчи не стартуют когда дошли, но текущий батч
   *  доучивается полностью. Сбрасывается в 02:00 MSK. */
  dailyPromotionLimit: 10,
  /** Стандартный размер батча, на который Pool промоутится в Passive. */
  learningBatchSize: 10,
  /** Минимальный размер батча: даёт меньше слов когда коллекция почти
   *  исчерпана или дневной лимит близок. Меньше — батч не стартует. */
  minBatchSize: 3,
} as const;

export type LearningConfig = typeof learningConfig;
