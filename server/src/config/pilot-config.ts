/**
 * Pilot Mode — централизованный реестр feature-флагов на пилот.
 *
 * Цель: сузить функционал до core-механики изучения слов для тестирования
 * на узком кругу пользователей. Лишние механики скрываются (но не удаляются),
 * чтобы при необходимости вернуть их одним переключением флага.
 *
 * Парный клиентский конфиг: client/src/lib/pilot-config.ts.
 * Парные точечные флаги (исторически): server/src/config/lives-config.ts → LIVES_ENABLED.
 *
 * Конвенция:
 * - Включено в пилоте → true
 * - Скрыто в пилоте  → false
 * - Точечные *_ENABLED константы внутри *-config.ts остаются single-source-of-truth
 *   для своей механики; этот файл переиспользует их через re-export, чтобы
 *   получить единую сводку «что в пилоте».
 *
 * Решения зафиксированы в docs/pilot-scope.md.
 */
import { LIVES_ENABLED } from './lives-config';

export const PILOT_FEATURES = {
  // ===== СКРЫТО В ПИЛОТЕ =====

  /** PvP-режим, рейтинг дуэлей. Бессмысленен на узком круге. */
  duels: false,

  /** Соревновательный рейтинг между юзерами (LP). Требует массы. */
  leagues: false,

  /** Гемы целиком: индикатор в шапке, /shop, награды, freeze. */
  gems: false,

  /** Double XP / XP boost-механики. Шум без соревновательного контекста. */
  xpBoost: false,

  /** Premium / IAP / Telegram Stars / YooKassa. */
  payments: false,

  /** Read-mode (отдельный режим чтения текстов). */
  reading: false,

  /** Grammar module (отдельный режим грамматики). */
  grammar: false,

  /** Онбординг (туры, объяснения механик). Кроме первого выбора коллекции. */
  onboarding: false,

  /** Система жизней (сердечки). Источник: lives-config.ts. */
  lives: LIVES_ENABLED,

  // ===== ОСТАВЛЕНО В ПИЛОТЕ =====

  /** Streak дней. В пилоте без freeze (гемы скрыты). */
  streakDays: true,

  /** Streak ответов в сессии. Без gem-награды. */
  streakAnswers: true,

  /** Друзья. Социальный список. */
  friends: true,

  /** XP и уровни. Без gem-награды на level up. */
  xpLevels: true,

  /** TTS-озвучка слов. Часть core learning loop. */
  tts: true,

  /** Дневные milestones (25 правильных = зачёт дня для streak). */
  milestones: true,
} as const;

export type PilotFeatureKey = keyof typeof PILOT_FEATURES;

export function isPilotFeatureEnabled(key: PilotFeatureKey): boolean {
  return PILOT_FEATURES[key];
}
