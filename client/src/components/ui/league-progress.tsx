import { isProtectedTier, getLeagueZoneInfo, TIER_THRESHOLDS } from '@/lib/league-config';
import { StatProgress } from '@/components/ui/stat-progress';
import type { UserSeasonStats, LeagueTier } from '@/types/api';

type LeagueProgressProps = {
  stats: UserSeasonStats;
  tier: LeagueTier;
};

export function LeagueProgress({ stats, tier }: LeagueProgressProps) {
  const isProtected = isProtectedTier(tier);
  const zoneInfo = getLeagueZoneInfo(tier, stats.leaguePoints);
  const thresholds = TIER_THRESHOLDS[tier];

  const zoneLabel = 'Рейтинговые очки';

  const targetLP = zoneInfo.zone === 'promotion'
    ? `${stats.leaguePoints} LP`
    : thresholds.promotion === Infinity
      ? `${stats.leaguePoints} LP`
      : `${stats.leaguePoints} / ${thresholds.promotion} LP`;

  const segments = isProtected
    ? [
        { widthClass: 'w-2/3', activeColor: 'var(--gray-9)', inactiveColor: 'var(--gray-6)', isActive: zoneInfo.zone === 'maintain' },
        { widthClass: 'w-1/3', activeColor: 'var(--green-9)', inactiveColor: 'var(--green-6)', isActive: zoneInfo.zone === 'promotion' },
      ]
    : [
        { widthClass: 'w-1/3', activeColor: 'var(--red-9)', inactiveColor: 'var(--red-6)', isActive: zoneInfo.zone === 'demotion' },
        { widthClass: 'w-1/3', activeColor: 'var(--gray-9)', inactiveColor: 'var(--gray-6)', isActive: zoneInfo.zone === 'maintain' },
        { widthClass: 'w-1/3', activeColor: 'var(--green-9)', inactiveColor: 'var(--green-6)', isActive: zoneInfo.zone === 'promotion' },
      ];

  return (
    <StatProgress
      variant="segmented"
      label={zoneLabel}
      value={targetLP}
      percent={zoneInfo.positionPercent}
      segments={segments}
      markerPercent={zoneInfo.positionPercent}
    />
  );
}
