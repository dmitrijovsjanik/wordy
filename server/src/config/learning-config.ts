/**
 * Конфигурация лестницы освоения слова.
 *
 * Все пороги перехода, интервалы и список разрешённых упражнений на каждом
 * уровне живут здесь. Менять параметры — только в этом файле, без
 * передеплоя кода.
 *
 * Лестница: encounter → passive → active → production → review.
 * Production отложен в MVP (см. план фазы 7) — `enabled: false`.
 *
 * См. фазу 2 плана переработки.
 */

import type { LearningTier } from '../services/analytics-service.js';

// Список упражнений, которые мы разрешаем показывать на каждом уровне.
// Названия соответствуют question.type на клиенте и `getGeneratorTypeFromQuestion`.
export type ExerciseType =
  | 'multiple-choice'
  | 'spelling'
  | 'match-pairs'
  | 'listening'
  | 'cloze'
  | 'free-recall'
  | 'dictation'
  | 'encounter-card';

export type TierConfig = {
  /** Сколько раз нужно «правильно» подряд, чтобы перейти на следующий tier.
   *  Для encounter — это число показов. */
  correctToAdvance: number;
  /** Какие типы упражнений показываем на этом tier. Пустой = encounter без проверки. */
  allowedExerciseTypes: readonly ExerciseType[];
  /** Включён ли tier для генерации в pickNextItem. */
  enabled: boolean;
};

export const learningConfig = {
  tiers: {
    encounter: {
      // Encounter — карточка-знакомство. 1 показ = переход на passive.
      correctToAdvance: 1,
      allowedExerciseTypes: ['encounter-card'] as const,
      enabled: true,
    },
    passive: {
      // Passive recall — узнавание (multiple-choice, match-pairs, listening).
      correctToAdvance: 2,
      allowedExerciseTypes: ['multiple-choice', 'match-pairs', 'listening'] as const,
      enabled: true,
    },
    active: {
      // Active recall — свободный ввод (free-recall, dictation).
      correctToAdvance: 2,
      allowedExerciseTypes: ['free-recall', 'dictation'] as const,
      enabled: true,
    },
    production: {
      // Production — слово в предложении (cloze). Включится после батч-прогона
      // AI-examples (фаза 6/7).
      correctToAdvance: 3,
      allowedExerciseTypes: ['cloze'] as const,
      enabled: false,
    },
    review: {
      // Review — после освоения. Используется для интервальных повторений.
      // correctToAdvance не имеет смысла на review (его не «проходят»).
      correctToAdvance: 0,
      allowedExerciseTypes: ['multiple-choice', 'free-recall', 'cloze'] as const,
      enabled: true,
    },
  },

  intervals: {
    /** Encounter → Passive: первый показ через 4 часа после знакомства. */
    encounterToPassiveHours: 4,
    /** Кулдаун после ошибки на passive/active (фаза изучения, без отката). */
    learningCooldownMinutes: 30,
    /** Интервалы между повторами правильных ответов на passive/active.
     *  [0]=4h после первого правильного, [1]=8h после второго. */
    learningIntervalsHours: [4, 8] as const,
    /** Интервалы review-фазы по `reviewStage` (0..N).
     *  При выходе из active в review reviewStage=0 → первый показ через 3 дня. */
    reviewIntervalsDays: [3, 7, 21, 60, 180] as const,
    /** Куда откатывает review при ошибке на review-повторе. */
    reviewWrongRollbackTier: 'active' as LearningTier,
    /** Кулдаун после ошибки в review до показа на новом tier'е. */
    reviewWrongCooldownDays: 1,
  },

  review: {
    /** Дефолтное число дней для «отложить» в обзоре. */
    snoozeDaysDefault: 7,
    /** Jitter ±N дней при snooze, чтобы отложенные слова не возвращались
     *  одной волной. Подтверждено в плане фазы 4. */
    snoozeJitterDays: 2,
    /** Сколько слов брать в feed обзора за один запрос. */
    feedQueueSize: 30,
  },
} as const;

export type LearningConfig = typeof learningConfig;
