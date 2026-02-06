import { Badge } from '@/components/ui/badge';
import { PROTECTED_TIERS, getLeagueZoneInfo } from '@/lib/league-config';
import { cn } from '@/lib/utils';
import type { UserSeasonStats, LeagueTier } from '@/types/api';

type LeagueProgressProps = {
  stats: UserSeasonStats;
  tier: LeagueTier;
  position?: { position: number; total: number } | null;
};

export function LeagueProgress({ stats, tier, position }: LeagueProgressProps) {
  const isProtected = PROTECTED_TIERS.includes(tier);

  const leagueZone = position && position.total > 0
    ? getLeagueZoneInfo(position.position, position.total, stats.leaguePoints, isProtected)
    : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{stats.leaguePoints}</span>
          <span className="text-sm text-[var(--gray-11)]">LP</span>
        </div>
        <div className="flex items-center gap-2">
          {position && position.total > 0 && (
            <Badge variant="secondary">
              #{position.position} из {position.total}
            </Badge>
          )}
          {leagueZone && (
            <span
              className={cn(
                'text-sm font-medium',
                leagueZone.zone === 'promotion_x3' && 'text-[var(--violet-11)]',
                leagueZone.zone === 'promotion_x2' && 'text-[var(--blue-11)]',
                leagueZone.zone === 'promotion_x1' && 'text-[var(--green-11)]',
                leagueZone.zone === 'demotion' && 'text-[var(--red-11)]',
                leagueZone.zone === 'safe' && 'text-[var(--gray-11)]',
              )}
            >
              {leagueZone.result > 0 && '+'}
              {leagueZone.result !== 0 ? `${leagueZone.result} дивизиона` : '±0'}
            </span>
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
                style={{ backgroundColor: leagueZone?.zone === 'demotion' ? 'var(--red-9)' : 'var(--red-6)' }}
              />
              {/* Безопасно — 1/3 */}
              <div
                className="h-full w-1/3"
                style={{ backgroundColor: leagueZone?.zone === 'safe' ? 'var(--gray-9)' : 'var(--gray-6)' }}
              />
              {/* Повышение — 1/3 разбито на 3 равные части */}
              <div
                className="h-full w-[11.1%]"
                style={{ backgroundColor: leagueZone?.zone === 'promotion_x1' ? 'var(--green-9)' : 'var(--green-6)' }}
              />
              <div
                className="h-full w-[11.1%]"
                style={{ backgroundColor: leagueZone?.zone === 'promotion_x2' ? 'var(--blue-9)' : 'var(--blue-6)' }}
              />
              <div
                className="h-full w-[11.1%]"
                style={{ backgroundColor: leagueZone?.zone === 'promotion_x3' ? 'var(--violet-9)' : 'var(--violet-6)' }}
              />
            </>
          ) : (
            <>
              {/* Безопасно — 1/2 */}
              <div
                className="h-full w-1/2"
                style={{ backgroundColor: leagueZone?.zone === 'safe' ? 'var(--gray-9)' : 'var(--gray-6)' }}
              />
              {/* Повышение — 1/2 разбито на 3 равные части */}
              <div
                className="h-full w-[16.6%]"
                style={{ backgroundColor: leagueZone?.zone === 'promotion_x1' ? 'var(--green-9)' : 'var(--green-6)' }}
              />
              <div
                className="h-full w-[16.6%]"
                style={{ backgroundColor: leagueZone?.zone === 'promotion_x2' ? 'var(--blue-9)' : 'var(--blue-6)' }}
              />
              <div
                className="h-full w-[16.7%]"
                style={{ backgroundColor: leagueZone?.zone === 'promotion_x3' ? 'var(--violet-9)' : 'var(--violet-6)' }}
              />
            </>
          )}
        </div>
        {/* Маркер позиции игрока */}
        {leagueZone && (
          <div
            className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `clamp(2px, ${leagueZone.positionPercent}%, calc(100% - 2px))` }}
          />
        )}
      </div>
    </div>
  );
}
