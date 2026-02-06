/**
 * Gems Economy Configuration
 *
 * Все константы экономики гемов в одном месте.
 */

// ─── Ежедневные награды ─────────────────────────────────────────────────────

/** Первый квиз за день (увеличивает стрик дней) */
export const GEMS_DAILY_PLAY = 5;

/** Победа в дуэли (макс. 1 раз в день) */
export const GEMS_DUEL_WIN_DAILY = 15;

// ─── Прогрессия ─────────────────────────────────────────────────────────────

/** Новый уровень */
export const GEMS_LEVEL_UP = 20;

// ─── Стрик дней ─────────────────────────────────────────────────────────────

/** Каждый 7-й день стрика */
export const GEMS_STREAK_7_DAYS = 30;

// ─── Стрик ответов подряд ───────────────────────────────────────────────────

/** 10 правильных подряд */
export const GEMS_ANSWER_STREAK_10 = 5;

/** 20 правильных подряд */
export const GEMS_ANSWER_STREAK_20 = 10;

/** 30 правильных подряд */
export const GEMS_ANSWER_STREAK_30 = 20;

/** Мильники стрика ответов: [порог, награда] */
export const ANSWER_STREAK_MILESTONES: ReadonlyArray<[number, number]> = [
  [10, GEMS_ANSWER_STREAK_10],
  [20, GEMS_ANSWER_STREAK_20],
  [30, GEMS_ANSWER_STREAK_30],
];

// ─── Заморозка стрика ───────────────────────────────────────────────────────

/** Цена заморозки в гемах */
export const STREAK_FREEZE_COST = 200;

/** Максимум заморозок в запасе (без ограничения) */
export const MAX_STREAK_FREEZES = Infinity;
