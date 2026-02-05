import { useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '@/stores/league-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeagueScroll } from '@/components/ui/league-scroll';
import { LeagueProgress } from '@/components/ui/league-progress';
import { BackButton } from '@/components/ui/back-button';
import { cn } from '@/lib/utils';
import { LP_THRESHOLDS, PROTECTED_TIERS, formatLpBoundary } from '@/lib/league-config';
import type { LeagueTier } from '@/types/api';

type Zone = {
  id: string;
  label: string;
  lpBoundary: string;
  color: string;
  placeholder: string;
};

function getZones(isProtected: boolean): Zone[] {
  const zones: Zone[] = [
    {
      id: 'promotion_x3',
      label: 'x3 продвижение',
      lpBoundary: formatLpBoundary(LP_THRESHOLDS.PROMOTION_3.min, Infinity),
      color: 'var(--violet-9)',
      placeholder: 'Пока никого',
    },
    {
      id: 'promotion_x2',
      label: 'x2 продвижение',
      lpBoundary: formatLpBoundary(LP_THRESHOLDS.PROMOTION_2.min, LP_THRESHOLDS.PROMOTION_2.max),
      color: 'var(--blue-9)',
      placeholder: 'Пока никого',
    },
    {
      id: 'promotion_x1',
      label: 'x1 продвижение',
      lpBoundary: formatLpBoundary(LP_THRESHOLDS.PROMOTION_1.min, LP_THRESHOLDS.PROMOTION_1.max),
      color: 'var(--green-9)',
      placeholder: 'Пока никого',
    },
    { id: 'safe', label: 'Безопасная зона', lpBoundary: '', color: 'var(--gray-9)', placeholder: 'Пока никого' },
  ];

  if (!isProtected) {
    zones.push({ id: 'demotion', label: 'Понижение', lpBoundary: '', color: 'var(--red-9)', placeholder: 'Пока никого' });
  }

  return zones;
}

type LeaderboardEntry = {
  userId: number;
  firstName: string;
  username: string | null;
  avatarUrl: string | null;
  leaguePoints: number;
  position: number;
  isCurrentUser: boolean;
};

type GroupedZones = {
  promotion_x3: LeaderboardEntry[];
  promotion_x2: LeaderboardEntry[];
  promotion_x1: LeaderboardEntry[];
  safe: LeaderboardEntry[];
  demotion: LeaderboardEntry[];
};

function groupByZones(entries: LeaderboardEntry[], isProtected: boolean): GroupedZones {
  const total = entries.length;
  if (total === 0) {
    return { promotion_x3: [], promotion_x2: [], promotion_x1: [], safe: [], demotion: [] };
  }

  const promotionEnd = Math.max(1, Math.ceil(total * 0.2));
  const demotionStart = Math.floor(total * 0.8) + 1;

  const promotion_x3: LeaderboardEntry[] = [];
  const promotion_x2: LeaderboardEntry[] = [];
  const promotion_x1: LeaderboardEntry[] = [];
  const safe: LeaderboardEntry[] = [];
  const demotion: LeaderboardEntry[] = [];

  for (const entry of entries) {
    if (entry.position <= promotionEnd) {
      // В зоне повышения — группируем по LP
      if (entry.leaguePoints >= LP_THRESHOLDS.PROMOTION_3.min) {
        promotion_x3.push(entry);
      } else if (entry.leaguePoints >= LP_THRESHOLDS.PROMOTION_2.min) {
        promotion_x2.push(entry);
      } else if (entry.leaguePoints >= LP_THRESHOLDS.PROMOTION_1.min) {
        promotion_x1.push(entry);
      } else {
        // Меньше порога, но в топ-20% — всё равно x1
        promotion_x1.push(entry);
      }
    } else if (!isProtected && entry.position >= demotionStart) {
      demotion.push(entry);
    } else {
      safe.push(entry);
    }
  }

  return { promotion_x3, promotion_x2, promotion_x1, safe, demotion };
}

export function Leaderboard() {
  const navigate = useNavigate();
  const {
    progress,
    stats,
    position,
    season,
    leaderboard,
    isLoading,
    fetchStatus,
    fetchLeaderboard,
  } = useLeagueStore();

  useBackButton(useCallback(() => navigate('/'), [navigate]));

  useEffect(() => {
    fetchStatus();
    fetchLeaderboard();
  }, [fetchStatus, fetchLeaderboard]);

  if (isLoading || !progress) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
        <BackButton to="/" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="flex flex-col gap-2">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4">
      <div className="mb-2">
        <BackButton to="/" />
      </div>

      {/* Текущий статус */}
      <Card className="overflow-hidden">
        <div className="mb-3 flex items-center justify-end">
          {season && (
            <span className="text-xs text-[var(--gray-11)]">
              Неделя {season.weekNumber}
            </span>
          )}
        </div>

        <LeagueScroll
          currentTier={progress.tier}
          currentDivision={progress.division}
          className="mb-4"
        />

        {stats && <LeagueProgress stats={stats} tier={progress.tier} position={position} />}
      </Card>

      {/* Таблица лидеров */}
      <LeaderboardList
        leaderboard={leaderboard}
        tier={progress.tier}
      />
    </div>
  );
}

function LeaderboardList({ leaderboard, tier }: { leaderboard: LeaderboardEntry[]; tier: LeagueTier }) {
  const isProtected = PROTECTED_TIERS.includes(tier);
  const zones = useMemo(() => getZones(isProtected), [isProtected]);
  const grouped = useMemo(() => groupByZones(leaderboard, isProtected), [leaderboard, isProtected]);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-bold">Таблица лидеров</h2>

      {zones.map((zone) => {
        const entries = grouped[zone.id as keyof GroupedZones];

        return (
          <div key={zone.id} className="flex flex-col gap-2">
            {/* Хедер зоны */}
            <div className="flex items-center gap-2">
              <span
                className="shrink-0 text-xs font-medium"
                style={{ color: zone.color }}
              >
                {zone.label}
              </span>
              <div
                className="h-0.5 flex-1 rounded-full"
                style={{ backgroundColor: zone.color }}
              />
              {zone.lpBoundary && (
                <span
                  className="shrink-0 text-xs font-medium"
                  style={{ color: zone.color }}
                >
                  {zone.lpBoundary}
                </span>
              )}
            </div>

            {/* Участники или плейсхолдер */}
            {entries.length === 0 ? (
              <div className="py-4 text-center text-sm text-[var(--gray-11)]">
                {zone.placeholder}
              </div>
            ) : (
              entries.map((entry) => (
                <Card
                  key={entry.userId}
                  className={cn(
                    'flex items-center gap-3 p-3',
                    entry.isCurrentUser && 'ring-2 ring-[var(--accent-7)]',
                  )}
                >
                  <span
                    className={cn(
                      'w-8 text-center font-bold',
                      entry.position <= 5 && 'text-[var(--violet-9)]',
                      entry.position > 5 && entry.position <= 15 && 'text-[var(--blue-9)]',
                    )}
                  >
                    {entry.position}
                  </span>

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gray-3)] text-sm font-medium">
                    {entry.firstName.charAt(0)}
                  </div>

                  <div className="flex flex-1 flex-col">
                    <span className="font-medium">{entry.firstName}</span>
                    {entry.username && (
                      <span className="text-xs text-[var(--gray-11)]">@{entry.username}</span>
                    )}
                  </div>

                  <span className="font-bold">{entry.leaguePoints} LP</span>
                </Card>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

export default Leaderboard;
