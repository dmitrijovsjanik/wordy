// ─── Season Schedule ─────────────────────────────────────────────────────────
// Время смены сезона (переход с вс на пн)
// Формат: { dayOfWeek, hour, minute, timezone }
// dayOfWeek: 0 = воскресенье, 1 = понедельник, ...
// Для 00:00 MSK (UTC+3) в ночь с вс на пн = воскресенье 21:00 UTC
export const SEASON_SCHEDULE = {
  // День недели для cron (0 = вс, 1 = пн)
  cronDayOfWeek: 0, // воскресенье по UTC
  // Час по UTC
  cronHourUTC: 21, // 21:00 UTC = 00:00 MSK
  // Минуты
  cronMinute: 0,
  // Сколько длится сезон в днях
  seasonDurationDays: 7,
  // За сколько часов до конца отправлять напоминание
  reminderHoursBeforeEnd: 24,
} as const;

// Cron expression для смены сезона: "минута час * * день_недели"
export const SEASON_CRON_EXPRESSION = `${SEASON_SCHEDULE.cronMinute} ${SEASON_SCHEDULE.cronHourUTC} * * ${SEASON_SCHEDULE.cronDayOfWeek}`;

// Cron expression для напоминания (за 24 часа до конца = суббота 21:00 UTC)
export const REMINDER_CRON_EXPRESSION = `${SEASON_SCHEDULE.cronMinute} ${SEASON_SCHEDULE.cronHourUTC} * * ${(SEASON_SCHEDULE.cronDayOfWeek + 6) % 7}`;

// ─── League Tiers ────────────────────────────────────────────────────────────

export const LEAGUE_TIERS = [
  'bronze',
  'silver',
  'gold',
  'amber',
  'sapphire',
  'amethyst',
  'topaz',
  'ruby',
  'legend',
] as const;

export type LeagueTier = (typeof LEAGUE_TIERS)[number];

export const LEAGUE_NAMES: Record<LeagueTier, string> = {
  bronze: 'Бронза',
  silver: 'Серебро',
  gold: 'Золото',
  amber: 'Янтарь',
  sapphire: 'Сапфир',
  amethyst: 'Аметист',
  topaz: 'Топаз',
  ruby: 'Рубин',
  legend: 'Легенда',
};

// Лиги без понижения (защита новичков)
export const PROTECTED_TIERS: LeagueTier[] = ['bronze', 'silver', 'gold'];

// LP за действия (базовые значения в увеличенной разрядности для точных модификаторов)
export const LP_CORRECT_ANSWER = 100;
export const LP_QUIZ_COMPLETE = 500;
export const LP_DUEL_WIN = 1000;
export const LP_STREAK_DAYS_MULTIPLIER = 200; // бонус за streak дней

// Re-export streak modifiers from progression-config (single source of truth)
export {
  getXpModifier,
  getLpModifier,
  applyModifier,
} from './progression-config.js';

// ─── Пороги LP по тирам ─────────────────────────────────────────────────────
// Масштабируются по лигам (~1.25x за тир) для нормального распределения

type TierThresholds = {
  demotion: number; // ниже → понижение (0 для protected)
  promotion: number; // выше → повышение
};

export const TIER_THRESHOLDS: Record<LeagueTier, TierThresholds> = {
  bronze:   { demotion: 0,    promotion: 2000 },
  silver:   { demotion: 0,    promotion: 2500 },
  gold:     { demotion: 0,    promotion: 3000 },
  amber:    { demotion: 2000, promotion: 4000 },
  sapphire: { demotion: 2500, promotion: 5000 },
  amethyst: { demotion: 3000, promotion: 6500 },
  topaz:    { demotion: 4000, promotion: 8000 },
  ruby:     { demotion: 5000, promotion: 10000 },
  legend:   { demotion: 6000, promotion: Infinity }, // нет повышения из Legend
};

// ─── Награды гемами за зоны по итогам сезона ────────────────────────────────

type TierRewards = {
  maintain: number;   // безопасная зона
  promotion: number;  // повышение
};

export const SEASON_REWARDS: Record<LeagueTier, TierRewards> = {
  bronze:   { maintain: 50,  promotion: 100 },
  silver:   { maintain: 50,  promotion: 100 },
  gold:     { maintain: 50,  promotion: 100 },
  amber:    { maintain: 75,  promotion: 150 },
  sapphire: { maintain: 75,  promotion: 150 },
  amethyst: { maintain: 100, promotion: 200 },
  topaz:    { maintain: 100, promotion: 200 },
  ruby:     { maintain: 150, promotion: 300 },
  legend:   { maintain: 150, promotion: 0 },   // из Legend некуда повышаться
};

// Лимит для группы понижения (максимум N человек получают -1)
export const DEMOTION_LIMIT = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Получить следующую лигу
export function getNextTier(tier: LeagueTier): LeagueTier | null {
  const idx = LEAGUE_TIERS.indexOf(tier);
  return idx < LEAGUE_TIERS.length - 1 ? LEAGUE_TIERS[idx + 1] : null;
}

// Получить предыдущую лигу
export function getPrevTier(tier: LeagueTier): LeagueTier | null {
  const idx = LEAGUE_TIERS.indexOf(tier);
  return idx > 0 ? LEAGUE_TIERS[idx - 1] : null;
}

// Проверить, защищена ли лига от понижения
export function isProtectedTier(tier: LeagueTier): boolean {
  return PROTECTED_TIERS.includes(tier);
}

// Определить зону пользователя по LP и тиру
export function getSeasonZone(
  tier: LeagueTier,
  leaguePoints: number,
): 'promotion' | 'maintain' | 'demotion' {
  const thresholds = TIER_THRESHOLDS[tier];

  if (leaguePoints >= thresholds.promotion) return 'promotion';
  if (isProtectedTier(tier) || leaguePoints >= thresholds.demotion) return 'maintain';
  return 'demotion';
}
