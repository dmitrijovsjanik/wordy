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
export const PROTECTED_TIERS: readonly string[] = ['bronze', 'silver', 'gold'];

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

// Типы зон лиги
export type LeagueZone = 'promotion_x3' | 'promotion_x2' | 'promotion_x1' | 'safe' | 'demotion';

export type LeagueZoneInfo = {
  positionPercent: number;
  zone: LeagueZone;
  result: number;
};

// Расчёт зоны лиги и позиции маркера на прогресс-баре
export function getLeagueZoneInfo(
  position: number,
  total: number,
  leaguePoints: number,
  isProtected: boolean,
): LeagueZoneInfo {
  // Реальные пороги по позиции: топ-20% повышение, низ-20% понижение
  const promotionThreshold = Math.max(1, Math.ceil(total * 0.2));
  const demotionThreshold = Math.floor(total * 0.8);

  let zone: LeagueZone = 'safe';
  let result = 0;

  // Определяем зону и результат
  if (position <= promotionThreshold) {
    if (leaguePoints >= LP_THRESHOLDS.PROMOTION_3.min) {
      zone = 'promotion_x3';
      result = 3;
    } else if (leaguePoints >= LP_THRESHOLDS.PROMOTION_2.min) {
      zone = 'promotion_x2';
      result = 2;
    } else if (leaguePoints >= LP_THRESHOLDS.PROMOTION_1.min) {
      zone = 'promotion_x1';
      result = 1;
    } else {
      zone = 'promotion_x1';
      result = 1;
    }
  } else if (!isProtected && position > demotionThreshold) {
    zone = 'demotion';
    result = -1;
  }

  // Визуальные границы зон на прогресс-баре
  // Non-protected: [demotion 0-33.3 | safe 33.3-66.6 | x1 66.6-77.7 | x2 77.7-88.8 | x3 88.8-100]
  // Protected:      [safe 0-50 | x1 50-66.6 | x2 66.6-83.3 | x3 83.3-100]
  const zoneBounds: Record<LeagueZone, { start: number; end: number }> = isProtected
    ? {
        demotion: { start: 0, end: 0 },
        safe: { start: 0, end: 50 },
        promotion_x1: { start: 50, end: 66.6 },
        promotion_x2: { start: 66.6, end: 83.3 },
        promotion_x3: { start: 83.3, end: 100 },
      }
    : {
        demotion: { start: 0, end: 33.3 },
        safe: { start: 33.3, end: 66.6 },
        promotion_x1: { start: 66.6, end: 77.7 },
        promotion_x2: { start: 77.7, end: 88.8 },
        promotion_x3: { start: 88.8, end: 100 },
      };

  const bounds = zoneBounds[zone];

  // Прогресс внутри зоны (0..1)
  let progressInZone = 0.5;

  if (zone === 'demotion') {
    const demotionZoneSize = total - demotionThreshold;
    const posInZone = position - demotionThreshold;
    progressInZone = 1 - posInZone / Math.max(1, demotionZoneSize);
  } else if (zone === 'safe') {
    const safeStart = promotionThreshold;
    const safeEnd = isProtected ? total : demotionThreshold;
    const safeZoneSize = safeEnd - safeStart;
    const posInZone = position - safeStart;
    progressInZone = 1 - posInZone / Math.max(1, safeZoneSize);
  } else {
    // Promotion zones — позиция по LP внутри диапазона зоны
    const lpRanges: Record<string, { min: number; max: number }> = {
      promotion_x1: { min: LP_THRESHOLDS.PROMOTION_1.min, max: LP_THRESHOLDS.PROMOTION_2.min },
      promotion_x2: { min: LP_THRESHOLDS.PROMOTION_2.min, max: LP_THRESHOLDS.PROMOTION_3.min },
      promotion_x3: { min: LP_THRESHOLDS.PROMOTION_3.min, max: LP_THRESHOLDS.PROMOTION_3.min + 5000 },
    };
    const range = lpRanges[zone];
    if (range) {
      progressInZone = Math.min(1, Math.max(0, (leaguePoints - range.min) / (range.max - range.min)));
    }
  }

  const positionPercent = bounds.start + progressInZone * (bounds.end - bounds.start);

  return { positionPercent, zone, result };
}
