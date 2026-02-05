// ─── LP Thresholds (клиентский конфиг, синхронизирован с server/src/config/league-config.ts) ───

// Пороги LP для результатов недели (разрядность x10)
export const LP_THRESHOLDS = {
  DEMOTION_2: { max: 999 },
  DEMOTION_1: { min: 1000, max: 1999 },
  MAINTAIN: { min: 2000, max: 3999 },
  PROMOTION_1: { min: 4000, max: 6999 },
  PROMOTION_2: { min: 7000, max: 9999 },
  PROMOTION_3: { min: 10000 },
} as const;

// Лиги без понижения (защита новичков)
export const PROTECTED_TIERS = ['bronze', 'silver', 'gold'] as const;

// Зоны прогресса для UI
export const LP_ZONES_FULL = [
  {
    min: 0,
    max: LP_THRESHOLDS.DEMOTION_2.max,
    label: 'Понижение',
    color: 'var(--red-9)',
  },
  {
    min: LP_THRESHOLDS.DEMOTION_1.min,
    max: LP_THRESHOLDS.DEMOTION_1.max,
    label: 'Риск',
    color: 'var(--amber-9)',
  },
  {
    min: LP_THRESHOLDS.MAINTAIN.min,
    max: LP_THRESHOLDS.MAINTAIN.max,
    label: 'Безопасно',
    color: 'var(--gray-9)',
  },
  {
    min: LP_THRESHOLDS.PROMOTION_1.min,
    max: LP_THRESHOLDS.PROMOTION_1.max,
    label: '+1 дивизион',
    color: 'var(--green-9)',
  },
  {
    min: LP_THRESHOLDS.PROMOTION_2.min,
    max: LP_THRESHOLDS.PROMOTION_2.max,
    label: '+2 дивизиона',
    color: 'var(--blue-9)',
  },
  {
    min: LP_THRESHOLDS.PROMOTION_3.min,
    max: Infinity,
    label: '+3 дивизиона',
    color: 'var(--violet-9)',
  },
] as const;

// Для защищённых лиг — нет понижения
export const LP_ZONES_PROTECTED = [
  {
    min: 0,
    max: LP_THRESHOLDS.MAINTAIN.max,
    label: 'Безопасно',
    color: 'var(--gray-9)',
  },
  {
    min: LP_THRESHOLDS.PROMOTION_1.min,
    max: LP_THRESHOLDS.PROMOTION_1.max,
    label: '+1 дивизион',
    color: 'var(--green-9)',
  },
  {
    min: LP_THRESHOLDS.PROMOTION_2.min,
    max: LP_THRESHOLDS.PROMOTION_2.max,
    label: '+2 дивизиона',
    color: 'var(--blue-9)',
  },
  {
    min: LP_THRESHOLDS.PROMOTION_3.min,
    max: Infinity,
    label: '+3 дивизиона',
    color: 'var(--violet-9)',
  },
] as const;

// Форматирование границ LP для отображения
export function formatLpBoundary(min: number, max: number): string {
  if (max === Infinity) {
    return `${min}+ LP`;
  }
  return `${min}-${max} LP`;
}
