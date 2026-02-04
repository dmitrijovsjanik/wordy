import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { UserSeasonStats, LeagueTier } from '@/types/api';

// Лиги без понижения (защита новичков)
const PROTECTED_TIERS: LeagueTier[] = ['bronze', 'silver', 'gold'];

const LP_THRESHOLDS_FULL = [
  { min: 0, max: 99, label: 'Понижение', color: 'var(--red-9)' },
  { min: 100, max: 199, label: 'Риск', color: 'var(--amber-9)' },
  { min: 200, max: 399, label: 'Безопасно', color: 'var(--gray-9)' },
  { min: 400, max: 699, label: '+1 дивизион', color: 'var(--green-9)' },
  { min: 700, max: 999, label: '+2 дивизиона', color: 'var(--blue-9)' },
  { min: 1000, max: Infinity, label: '+3 дивизиона', color: 'var(--violet-9)' },
];

// Для защищённых лиг — нет понижения
const LP_THRESHOLDS_PROTECTED = [
  { min: 0, max: 399, label: 'Безопасно', color: 'var(--gray-9)' },
  { min: 400, max: 699, label: '+1 дивизион', color: 'var(--green-9)' },
  { min: 700, max: 999, label: '+2 дивизиона', color: 'var(--blue-9)' },
  { min: 1000, max: Infinity, label: '+3 дивизиона', color: 'var(--violet-9)' },
];

type LeagueProgressProps = {
  stats: UserSeasonStats;
  tier: LeagueTier;
  position?: { position: number; total: number } | null;
};

export function LeagueProgress({ stats, tier, position }: LeagueProgressProps) {
  const isProtected = PROTECTED_TIERS.includes(tier);
  const thresholds = isProtected ? LP_THRESHOLDS_PROTECTED : LP_THRESHOLDS_FULL;

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
