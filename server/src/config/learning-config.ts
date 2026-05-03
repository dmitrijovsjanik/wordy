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
  | 'cloze-input'
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
      // Active recall — свободный ввод (только free-recall ru→en).
      // На главной экране ровно один формат «русский стимул → английский ввод»;
      // dictation/multiple-choice не используются (см. требование «без квизов»).
      correctToAdvance: 2,
      allowedExerciseTypes: ['free-recall'] as const,
      enabled: true,
    },
    production: {
      // Production — контекстный recall: предложение с пропуском, без вариантов.
      // Отличается от active (просто слово→слово) тем, что слово используется
      // в контексте предложения. Если для meaning'а нет подходящего примера —
      // generate-for-tier фолбэчит на free-recall.
      correctToAdvance: 3,
      allowedExerciseTypes: ['cloze-input'] as const,
      enabled: true,
    },
    review: {
      // Review — после освоения. Только free-recall ru→en, чтобы интервальное
      // повторение шло в том же формате, что и active. multiple-choice/cloze
      // убраны (квизы запрещены на главной).
      correctToAdvance: 0,
      allowedExerciseTypes: ['free-recall'] as const,
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
    /** Интервалы между повторами правильных ответов в фазе изучения.
     *  [0] — лок при переходе на следующий tier (passive→active, active→production).
     *  [1] — лок после 1-го правильного на tier'е (когда нужно ещё одно для advance).
     *
     *  Оба = 0: нет spaced repetition внутри learning-фазы. Слово остаётся
     *  доступным в той же сессии, чтобы пользователь мог пройти весь путь
     *  encounter → passive → active → production → review за один заход.
     *  Anti-repeat (excludeMeaningIds в pickNextItem) предотвращает показ
     *  одного и того же слова подряд. SRS включается только в review-фазе
     *  через reviewIntervalsDays (3д, 7д, 21д, ...). */
    learningIntervalsHours: [0, 0] as const,
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
