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
 * Решение по конкретным механикам делается отдельным проходом — см.
 * docs/pilot-scope.md.
 */
import { LIVES_ENABLED } from './lives-config';

export const PILOT_FEATURES = {
  /** Система жизней (сердечки). Источник: lives-config.ts. */
  lives: LIVES_ENABLED,

  // Слоты под будущие решения (заполнятся по мере прохода по механикам).
  // Пример: duels: false, leagues: false, shop: false, streak: true, ...
} as const;

export type PilotFeatureKey = keyof typeof PILOT_FEATURES;

export function isPilotFeatureEnabled(key: PilotFeatureKey): boolean {
  return PILOT_FEATURES[key];
}
