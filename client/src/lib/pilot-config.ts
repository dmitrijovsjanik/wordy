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
 * Решение по конкретным механикам делается отдельным проходом — см.
 * docs/pilot-scope.md.
 */
import { LIVES_ENABLED } from './feature-flags';

export const PILOT_FEATURES = {
  /** Система жизней (сердечки). Источник: feature-flags.ts. */
  lives: LIVES_ENABLED,

  // Слоты под будущие решения (заполнятся по мере прохода по механикам).
} as const;

export type PilotFeatureKey = keyof typeof PILOT_FEATURES;

export function isPilotFeatureEnabled(key: PilotFeatureKey): boolean {
  return PILOT_FEATURES[key];
}
