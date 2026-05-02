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
  | 'encounter-card'
  | 'passive-recall-card';

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
      // Passive recall — флешкарта с флипом и самооценкой через свайп.
      // Пользователь видит слово+пример, переворачивает карточку, видит перевод
      // и сам выбирает «знал» (свайп вправо) / «не знал» (свайп влево).
      // Multiple-choice/match-pairs/listening здесь больше не используются —
      // это узнавание с подсказкой через варианты, а не настоящий passive recall.
      correctToAdvance: 2,
      allowedExerciseTypes: ['passive-recall-card'] as const,
      enabled: true,
    },
    active: {
      // Active recall — свободный ввод (free-recall, dictation).
      correctToAdvance: 2,
      allowedExerciseTypes: ['free-recall', 'dictation'] as const,
      enabled: true,
    },
    production: {
      // Production — слово в предложении (cloze). Включён после фазы 6:
      // 2037 meanings получили AI-examples + grammar + common_errors через
      // OpenAI Batch API (см. scripts/generate-ai-content.ts). Cloze-генератор
      // работает только для meanings с examples в word_ai_content.
      correctToAdvance: 3,
      allowedExerciseTypes: ['cloze'] as const,
      enabled: true,
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
    /** Encounter → Passive: 0 = слово сразу доступно как passive в той же сессии.
     *  Обоснование: при cooldown'е >0 в первой сессии видны только encounter-карточки,
     *  потому что каждое новое слово блокируется до следующего дня. */
    encounterToPassiveHours: 0,
    /** Кулдаун после ошибки на passive/active (фаза изучения, без отката). */
    learningCooldownMinutes: 30,
    /** Интервалы между повторами правильных ответов на passive/active.
     *  [0]=0 — после первого правильного passive слово остаётся доступным в той же
     *  сессии (но pickNextItem отдаст приоритет другим словам по ORDER BY).
     *  [1]=8h — после второго правильного (продвижение active→production) уже spaced. */
    learningIntervalsHours: [0, 8] as const,
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

  errors: {
    /** Слово попадает в «проблемные», если за окно было ≥N ошибок. */
    thresholdCount: 3,
    /** Окно агрегации в днях. Покрывает типичные перерывы в обучении (≤2 мес). */
    windowDays: 60,
  },
} as const;

export type LearningConfig = typeof learningConfig;
