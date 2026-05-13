/**
 * In-memory счётчик квоты выдачи карточек.
 *
 * Цикл из 6 позиций (4:1:1):
 *   позиции 0,1,2,3 → 'main'       (L1-L3: encounter/active + word-level review)
 *   позиция 4       → 'production' (L4 meaning-level)
 *   позиция 5       → 'review'     (L5 meaning-level review due)
 *
 * Счётчик инкрементируется ТОЛЬКО при фактическом возврате карточки
 * (через основной слот или fallback). При embedded_review/empty слот
 * не сгорает — counter остаётся на той же позиции до следующей
 * успешной выдачи.
 *
 * Хранение in-memory. При рестарте сервера сбрасывается — на пилоте
 * приемлемо. Не персистится в БД (см. ТЗ).
 */

const counters: Map<number, number> = new Map();

const CYCLE_LENGTH = 6;

export type QuotaSlot = 'main' | 'production' | 'review';

/**
 * Текущий слот юзера. НЕ инкрементирует counter — это делает advanceSlot
 * после фактического возврата карточки.
 */
export function getCurrentSlot(userId: number): QuotaSlot {
  const position = counters.get(userId) ?? 0;
  return slotForPosition(position);
}

/**
 * Сдвинуть counter на следующую позицию. Вызывается ТОЛЬКО когда карточка
 * фактически возвращена клиенту (через основной слот или fallback).
 */
export function advanceSlot(userId: number): void {
  const position = counters.get(userId) ?? 0;
  counters.set(userId, (position + 1) % CYCLE_LENGTH);
}

/**
 * Сбросить counter (используется при logout / reset / тестах).
 */
export function resetCounter(userId: number): void {
  counters.delete(userId);
}

/** Только для тестов. */
export function _resetAllCounters(): void {
  counters.clear();
}

function slotForPosition(position: number): QuotaSlot {
  if (position >= 0 && position <= 3) return 'main';
  if (position === 4) return 'production';
  return 'review';
}
