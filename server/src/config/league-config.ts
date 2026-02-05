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

// Пороги LP для результатов недели (увеличены x10 под новую разрядность)
export const LP_THRESHOLDS = {
  DEMOTION_2: { max: 999 },
  DEMOTION_1: { min: 1000, max: 1999 },
  MAINTAIN: { min: 2000, max: 3999 },
  PROMOTION_1: { min: 4000, max: 6999 },
  PROMOTION_2: { min: 7000, max: 9999 },
  PROMOTION_3: { min: 10000 },
} as const;

// Лимиты для групп понижения
export const DEMOTION_LIMITS = {
  DEMOTION_2_LIMIT: 5,
  DEMOTION_1_LIMIT: 10,
} as const;

// Топ-позиции для бонусов повышения
export const TOP_POSITIONS = {
  PROMOTION_3_TOP: 5,
  PROMOTION_2_TOP: 10,
} as const;

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

// Рассчитать изменение дивизионов
export function calculateDivisionChange(
  tier: LeagueTier,
  division: number,
  change: number,
): { newTier: LeagueTier; newDivision: number } {
  let newTier = tier;
  let newDivision = division - change; // меньший дивизион = выше (I лучше III)

  // Повышение в следующую лигу
  while (newDivision < 1) {
    const nextTier = getNextTier(newTier);
    if (nextTier) {
      newTier = nextTier;
      newDivision += 3;
    } else {
      newDivision = 1; // Топ лиги
      break;
    }
  }

  // Понижение в предыдущую лигу
  while (newDivision > 3) {
    // Проверяем защиту от понижения
    if (isProtectedTier(newTier)) {
      newDivision = 3; // Не опускаемся ниже III дивизиона защищённой лиги
      break;
    }

    const prevTier = getPrevTier(newTier);
    if (prevTier) {
      newTier = prevTier;
      newDivision -= 3;
    } else {
      newDivision = 3; // Дно
      break;
    }
  }

  return { newTier, newDivision };
}
