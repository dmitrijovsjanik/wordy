import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { LP_ZONES_FULL, LP_ZONES_PROTECTED, PROTECTED_TIERS } from '@/lib/league-config';
import type { UserSeasonStats, LeagueTier } from '@/types/api';

type LeagueProgressProps = {
  stats: UserSeasonStats;
  tier: LeagueTier;
  position?: { position: number; total: number } | null;
};

export function LeagueProgress({ stats, tier, position }: LeagueProgressProps) {
  const isProtected = PROTECTED_TIERS.includes(tier);
  const thresholds = isProtected ? LP_ZONES_PROTECTED : LP_ZONES_FULL;

  const currentThreshold = thresholds.find(
    (t) => stats.leaguePoints >= t.min && stats.leaguePoints <= t.max,
  );

  const nextThreshold = thresholds.find((t) => stats.leaguePoints < t.min);
  const progressPercent = nextThreshold
    ? ((stats.leaguePoints - (currentThreshold?.min ?? 0)) /
        ((nextThreshold.min) - (currentThreshold?.min ?? 0))) *
      100
    : 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{stats.leaguePoints}</span>
          <span className="text-sm text-[var(--gray-11)]">LP</span>
        </div>
        {position && position.total > 0 && (
          <Badge variant="secondary">
            #{position.position} из {position.total}
          </Badge>
        )}
      </div>

      <Progress
        value={progressPercent}
        className="h-3"
        style={{ '--progress-bg': currentThreshold?.color } as React.CSSProperties}
      />

      <div className="flex justify-between text-xs text-[var(--gray-11)]">
        <span>{currentThreshold?.label}</span>
        {nextThreshold && (
          <span>
            До следующего: {nextThreshold.min - stats.leaguePoints} LP
          </span>
        )}
      </div>
    </div>
  );
}
