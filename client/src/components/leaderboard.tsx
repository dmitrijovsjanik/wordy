import { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '@/stores/league-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeagueScroll } from '@/components/ui/league-scroll';
import { LeagueProgress } from '@/components/ui/league-progress';
import { BackButton } from '@/components/ui/back-button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUp01Icon, ArrowDown01Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { LP_THRESHOLDS, PROTECTED_TIERS, formatLpBoundary } from '@/lib/league-config';
import type { LeagueTier } from '@/types/api';

function formatTimeLeft(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  if (diff <= 0) return '0ч';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}д ${hours}ч`;
  return `${hours}ч`;
}

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
  lpToday: number;
  positionChange: number;
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
  const [timeLeft, setTimeLeft] = useState('');

  useBackButton(useCallback(() => navigate('/'), [navigate]));

  useEffect(() => {
    fetchStatus();
    fetchLeaderboard();
  }, [fetchStatus, fetchLeaderboard]);

  // Обновляем таймер каждую минуту
  useEffect(() => {
    if (!season?.startedAt) return;

    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);

    const updateTimer = () => setTimeLeft(formatTimeLeft(endDate));
    updateTimer();

    const interval = setInterval(updateTimer, 60 * 1000);
    return () => clearInterval(interval);
  }, [season?.startedAt]);

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
      <Card className="overflow-hidden pt-3">
        {/* Заголовок сезона */}
        {season && (
          <div className="mb-4 flex items-center justify-between">
            <span className="text-lg font-bold">Сезон {season.weekNumber}</span>
            <div className="flex items-center gap-1 text-sm text-[var(--gray-11)]">
              <HugeiconsIcon icon={Clock01Icon} size={14} />
              <span>{timeLeft || '—'}</span>
            </div>
          </div>
        )}

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
                  {/* Позиция и изменение */}
                  <div className="flex w-8 flex-col items-center">
                    <span
                      className="font-bold"
                      style={{ color: zone.id !== 'safe' ? zone.color : undefined }}
                    >
                      {entry.position}
                    </span>
                    {entry.positionChange !== 0 && (
                      <span
                        className={cn(
                          'flex items-center text-xs',
                          entry.positionChange > 0 && 'text-[var(--green-11)]',
                          entry.positionChange < 0 && 'text-[var(--red-11)]',
                        )}
                      >
                        <HugeiconsIcon
                          icon={entry.positionChange > 0 ? ArrowUp01Icon : ArrowDown01Icon}
                          size={12}
                        />
                        {Math.abs(entry.positionChange)}
                      </span>
                    )}
                  </div>

                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gray-3)] text-sm font-medium">
                    {entry.firstName.charAt(0)}
                  </div>

                  <div className="flex flex-1 flex-col">
                    <span className="font-medium">{entry.firstName}</span>
                  </div>

                  {/* LP и сегодняшний прирост */}
                  <div className="flex flex-col items-end">
                    <span className="font-bold">{entry.leaguePoints} LP</span>
                    {entry.isCurrentUser && entry.lpToday > 0 && (
                      <span className="text-xs text-[var(--green-11)]">+{entry.lpToday}</span>
                    )}
                  </div>
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
