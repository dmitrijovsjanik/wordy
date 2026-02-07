import { Badge } from '@/components/ui/badge';
import { isProtectedTier, getLeagueZoneInfo, TIER_THRESHOLDS, SEASON_REWARDS } from '@/lib/league-config';
import { cn } from '@/lib/utils';
import type { UserSeasonStats, LeagueTier } from '@/types/api';

type LeagueProgressProps = {
  stats: UserSeasonStats;
  tier: LeagueTier;
};

export function LeagueProgress({ stats, tier }: LeagueProgressProps) {
  const isProtected = isProtectedTier(tier);
  const zoneInfo = getLeagueZoneInfo(tier, stats.leaguePoints);
  const thresholds = TIER_THRESHOLDS[tier];
  const rewards = SEASON_REWARDS[tier];

  const zoneLabel = zoneInfo.zone === 'promotion'
    ? 'Повышение'
    : zoneInfo.zone === 'demotion'
      ? 'Понижение'
      : 'Безопасно';

  const rewardText = zoneInfo.zone === 'promotion'
    ? rewards.promotion > 0 ? `+${rewards.promotion}` : null
    : zoneInfo.zone === 'maintain'
      ? `+${rewards.maintain}`
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{stats.leaguePoints}</span>
          <span className="text-sm text-[var(--gray-11)]">LP</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-medium',
              zoneInfo.zone === 'promotion' && 'text-[var(--green-11)]',
              zoneInfo.zone === 'demotion' && 'text-[var(--red-11)]',
              zoneInfo.zone === 'maintain' && 'text-[var(--gray-11)]',
            )}
          >
            {zoneLabel}
          </span>
          {rewardText && (
            <Badge variant="secondary">
              {rewardText} 💎
            </Badge>
          )}
        </div>
      </div>

      {/* Сегментированный прогресс-бар */}
      <div className="relative h-3 w-full">
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {!isProtected ? (
            <>
              {/* Понижение — 1/3 */}
              <div
                className="h-full w-1/3"
                style={{ backgroundColor: zoneInfo.zone === 'demotion' ? 'var(--red-9)' : 'var(--red-6)' }}
              />
              {/* Безопасно — 1/3 */}
              <div
                className="h-full w-1/3"
                style={{ backgroundColor: zoneInfo.zone === 'maintain' ? 'var(--gray-9)' : 'var(--gray-6)' }}
              />
              {/* Повышение — 1/3 */}
              <div
                className="h-full w-1/3"
                style={{ backgroundColor: zoneInfo.zone === 'promotion' ? 'var(--green-9)' : 'var(--green-6)' }}
              />
            </>
          ) : (
            <>
              {/* Безопасно — 2/3 */}
              <div
                className="h-full w-2/3"
                style={{ backgroundColor: zoneInfo.zone === 'maintain' ? 'var(--gray-9)' : 'var(--gray-6)' }}
              />
              {/* Повышение — 1/3 */}
              <div
                className="h-full w-1/3"
                style={{ backgroundColor: zoneInfo.zone === 'promotion' ? 'var(--green-9)' : 'var(--green-6)' }}
              />
            </>
          )}
        </div>
        {/* Маркер позиции игрока */}
        <div
          className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `clamp(2px, ${zoneInfo.positionPercent}%, calc(100% - 2px))` }}
        />
      </div>

      {/* Пороги под прогресс-баром */}
      <div className="flex justify-between text-[10px] text-[var(--gray-11)]">
        {!isProtected && (
          <span>{thresholds.demotion} LP</span>
        )}
        <span className={isProtected ? '' : 'ml-auto'}>
          {thresholds.promotion === Infinity ? '' : `${thresholds.promotion} LP`}
        </span>
      </div>
    </div>
  );
}
