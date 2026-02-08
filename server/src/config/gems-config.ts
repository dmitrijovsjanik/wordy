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

// ─── Стрик ответов подряд (разово в день) ────────────────────────────────────

/** 5 правильных подряд */
export const GEMS_ANSWER_STREAK_5 = 5;

/** Мильники стрика ответов: [порог, награда] */
export const ANSWER_STREAK_MILESTONES: ReadonlyArray<[number, number]> = [
  [5, GEMS_ANSWER_STREAK_5],
];

// ─── Правильные ответы за день (суммарные, разово в день) ────────────────────

/** 25 правильных за день */
export const GEMS_DAILY_CORRECT_25 = 10;

/** 50 правильных за день */
export const GEMS_DAILY_CORRECT_50 = 15;

/** Мильники правильных ответов за день: [порог, награда] */
export const DAILY_CORRECT_MILESTONES: ReadonlyArray<[number, number]> = [
  [25, GEMS_DAILY_CORRECT_25],
  [50, GEMS_DAILY_CORRECT_50],
];

// ─── Заморозка стрика ───────────────────────────────────────────────────────

/** Цена заморозки в гемах */
export const STREAK_FREEZE_COST = 200;

/** Максимум заморозок в запасе (без ограничения) */
export const MAX_STREAK_FREEZES = Infinity;

// ─── Паки заморозок ──────────────────────────────────────────────────────────

export type FreezePack = {
  days: number;
  gems: number;
  rubPrice: number;
};

/** Паки заморозок для магазина (скидка за объём) */
export const FREEZE_PACKS: readonly FreezePack[] = [
  { days: 1,  gems: 200,  rubPrice: 49  },
  { days: 2,  gems: 350,  rubPrice: 79  },
  { days: 7,  gems: 1000, rubPrice: 249 },
  { days: 14, gems: 1800, rubPrice: 449 },
];
