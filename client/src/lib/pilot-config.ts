/**
 * Pilot Mode — централизованный реестр feature-флагов на пилот (клиент).
 *
 * Цель: сузить функционал до core-механики изучения слов для тестирования
 * на узком кругу пользователей. Лишние механики скрываются (но не удаляются),
 * чтобы при необходимости вернуть их одним переключением флага.
 *
 * Парный серверный конфиг: server/src/config/pilot-config.ts.
 * Парные точечные флаги (исторически): client/src/lib/feature-flags.ts → LIVES_ENABLED.
 *
 * Конвенция:
 * - Включено в пилоте → true
 * - Скрыто в пилоте  → false
 * - Точечные *_ENABLED константы в feature-flags.ts остаются
 *   single-source-of-truth; этот файл переиспользует их через re-export,
 *   чтобы получить единую сводку «что в пилоте».
 *
 * Решения зафиксированы в docs/pilot-scope.md.
 */
import { LIVES_ENABLED } from './feature-flags';

export const PILOT_FEATURES = {
  // duels/reading/grammar/review/spelling/problems/modes удалены вместе с
  // legacy-кодом (см. archive/v1-learning-flow/). Оставляем флаги, которые
  // реально что-то скрывают в живых компонентах.

  /** Лиги — экран /leaderboard удалён, но league-виджеты остались в
   *  dashboard/profile/vocabulary-section/reward-feedback. Скрываются этим флагом. */
  leagues: false,

  /** Гемы целиком: индикатор в шапке, /shop, тостеры наград. */
  gems: false,

  /** Double XP / boost-таймер. */
  xpBoost: false,

  /** Premium-страницы, кнопки оплаты, Telegram Stars. */
  payments: false,

  /** Онбординг — туры, объяснялки. Кроме первого выбора коллекции. */
  onboarding: false,

  /** Система жизней (сердечки). Источник: feature-flags.ts. */
  lives: LIVES_ENABLED,

  /** Streak дней. В пилоте без freeze. */
  streakDays: true,

  /** Streak ответов в сессии. */
  streakAnswers: true,

  /** Друзья. */
  friends: true,

  /** XP и уровни. */
  xpLevels: true,

  /** TTS-озвучка. */
  tts: true,

  /** Milestones (25 правильных = зачёт дня для streak). */
  milestones: true,
} as const;

export type PilotFeatureKey = keyof typeof PILOT_FEATURES;

export function isPilotFeatureEnabled(key: PilotFeatureKey): boolean {
  return PILOT_FEATURES[key];
}
