/**
 * Moscow timezone (UTC+3) date utilities.
 *
 * Весь проект работает по МСК: дневной сброс стрика, мильников,
 * дуэльных наград и снимков лиги происходит в 00:00 МСК = 21:00 UTC.
 */

const MSK_OFFSET_HOURS = 3;

/**
 * Начало текущего дня по МСК (00:00 MSK = 21:00 UTC предыдущего дня).
 */
export function getMskTodayStart(now: Date = new Date()): Date {
  // Сдвигаем UTC-время на +3 часа, берём начало этих «суток», сдвигаем обратно
  const mskMs = now.getTime() + MSK_OFFSET_HOURS * 3600_000;
  const mskDay = new Date(mskMs);
  return new Date(
    Date.UTC(mskDay.getUTCFullYear(), mskDay.getUTCMonth(), mskDay.getUTCDate()) - MSK_OFFSET_HOURS * 3600_000,
  );
}

/**
 * Нормализация даты из БД к «началу дня по МСК» — для сравнения.
 */
export function toMskDayStart(date: Date): Date {
  return getMskTodayStart(date);
}
