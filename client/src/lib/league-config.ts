// ─── Клиентский конфиг лиг (синхронизирован с server/src/config/league-config.ts) ───

import type { LeagueTier } from '@/types/api';

// Лиги без понижения (защита новичков)
export const PROTECTED_TIERS: readonly string[] = ['bronze', 'silver', 'gold'];

// ─── Пороги LP по тирам ─────────────────────────────────────────────────────

type TierThresholds = {
  demotion: number;
  promotion: number;
};

export const TIER_THRESHOLDS: Record<LeagueTier, TierThresholds> = {
  bronze:   { demotion: 0,      promotion: 12_000 },
  silver:   { demotion: 0,      promotion: 17_000 },
  gold:     { demotion: 0,      promotion: 24_000 },
  amber:    { demotion: 14_000, promotion: 36_000 },
  sapphire: { demotion: 19_000, promotion: 48_000 },
  amethyst: { demotion: 24_000, promotion: 60_000 },
  topaz:    { demotion: 38_000, promotion: 95_000 },
  ruby:     { demotion: 48_000, promotion: 120_000 },
  legend:   { demotion: 60_000, promotion: Infinity },
};

// ─── Награды гемами за зоны по итогам сезона ────────────────────────────────

type TierRewards = {
  maintain: number;
  promotion: number;
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
  legend:   { maintain: 150, promotion: 0 },
};

// ─── Зоны лиги ──────────────────────────────────────────────────────────────

export type LeagueZone = 'promotion' | 'maintain' | 'demotion';

export type LeagueZoneInfo = {
  positionPercent: number;
  zone: LeagueZone;
  tierChange: number; // +1, 0, -1
};

export function isProtectedTier(tier: LeagueTier): boolean {
  return PROTECTED_TIERS.includes(tier);
}

export function getSeasonZone(tier: LeagueTier, leaguePoints: number): LeagueZone {
  const thresholds = TIER_THRESHOLDS[tier];
  if (leaguePoints >= thresholds.promotion) return 'promotion';
  if (isProtectedTier(tier) || leaguePoints >= thresholds.demotion) return 'maintain';
  return 'demotion';
}

// Расчёт зоны лиги и позиции маркера на прогресс-баре
export function getLeagueZoneInfo(
  tier: LeagueTier,
  leaguePoints: number,
): LeagueZoneInfo {
  const zone = getSeasonZone(tier, leaguePoints);
  const thresholds = TIER_THRESHOLDS[tier];
  const isProtected = isProtectedTier(tier);

  let tierChange = 0;
  if (zone === 'promotion') tierChange = 1;
  else if (zone === 'demotion') tierChange = -1;

  // Визуальные границы зон на прогресс-баре
  // Non-protected: [demotion 0-33.3 | maintain 33.3-66.6 | promotion 66.6-100]
  // Protected:      [maintain 0-66.6 | promotion 66.6-100]
  const zoneBounds: Record<LeagueZone, { start: number; end: number }> = isProtected
    ? {
        demotion: { start: 0, end: 0 },
        maintain: { start: 0, end: 66.6 },
        promotion: { start: 66.6, end: 100 },
      }
    : {
        demotion: { start: 0, end: 33.3 },
        maintain: { start: 33.3, end: 66.6 },
        promotion: { start: 66.6, end: 100 },
      };

  const bounds = zoneBounds[zone];

  // Прогресс внутри зоны (0..1)
  let progressInZone = 0.5;

  if (zone === 'demotion') {
    // 0 LP → 0%, demotion threshold → 100%
    progressInZone = Math.min(1, leaguePoints / Math.max(1, thresholds.demotion));
  } else if (zone === 'maintain') {
    const start = isProtected ? 0 : thresholds.demotion;
    const end = thresholds.promotion;
    progressInZone = Math.min(1, Math.max(0, (leaguePoints - start) / Math.max(1, end - start)));
  } else {
    // promotion — LP уже выше порога
    const promotionCeiling = thresholds.promotion + thresholds.promotion * 0.5;
    progressInZone = Math.min(1, (leaguePoints - thresholds.promotion) / Math.max(1, promotionCeiling - thresholds.promotion));
  }

  const positionPercent = bounds.start + progressInZone * (bounds.end - bounds.start);

  return { positionPercent, zone, tierChange };
}

// Форматирование порога LP
export function formatLpThreshold(tier: LeagueTier, zone: 'promotion' | 'demotion'): string {
  const thresholds = TIER_THRESHOLDS[tier];
  const value = zone === 'promotion' ? thresholds.promotion : thresholds.demotion;
  if (value === Infinity) return '';
  return `${value}+ LP`;
}
