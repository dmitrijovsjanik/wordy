import { useEffect, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '@/stores/league-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LeagueScroll } from '@/components/ui/league-scroll';
import { LeagueProgress } from '@/components/ui/league-progress';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUp01Icon, ArrowDown01Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { TIER_THRESHOLDS, SEASON_REWARDS, isProtectedTier } from '@/lib/league-config';
import { Avatar } from '@/components/ui/avatar';
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
  id: 'promotion' | 'maintain' | 'demotion';
  label: string;
  reward: string;
  color: string;
  placeholder: string;
};

function getZones(tier: LeagueTier): Zone[] {
  const rewards = SEASON_REWARDS[tier];
  const thresholds = TIER_THRESHOLDS[tier];
  const isProtected = isProtectedTier(tier);

  const zones: Zone[] = [
    {
      id: 'promotion',
      label: 'Повышение',
      reward: thresholds.promotion === Infinity ? '' : `${thresholds.promotion}+ LP — +${rewards.promotion} 💎`,
      color: 'var(--green-9)',
      placeholder: 'Пока никого',
    },
    {
      id: 'maintain',
      label: 'Безопасная зона',
      reward: `+${rewards.maintain} 💎`,
      color: 'var(--gray-9)',
      placeholder: 'Пока никого',
    },
  ];

  if (!isProtected) {
    zones.push({
      id: 'demotion',
      label: 'Понижение',
      reward: `< ${thresholds.demotion} LP`,
      color: 'var(--red-9)',
      placeholder: 'Пока никого',
    });
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
  promotion: LeaderboardEntry[];
  maintain: LeaderboardEntry[];
  demotion: LeaderboardEntry[];
};

function groupByZones(entries: LeaderboardEntry[], tier: LeagueTier): GroupedZones {
  const thresholds = TIER_THRESHOLDS[tier];
  const isProtected = isProtectedTier(tier);

  const promotion: LeaderboardEntry[] = [];
  const maintain: LeaderboardEntry[] = [];
  const demotion: LeaderboardEntry[] = [];

  for (const entry of entries) {
    if (entry.leaguePoints >= thresholds.promotion) {
      promotion.push(entry);
    } else if (isProtected || entry.leaguePoints >= thresholds.demotion) {
      maintain.push(entry);
    } else {
      demotion.push(entry);
    }
  }

  return { promotion, maintain, demotion };
}

export function Leaderboard() {
  const navigate = useNavigate();
  const {
    progress,
    stats,
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
      <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
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
    <div className="flex flex-col gap-4 px-4 pt-4 pb-4">
      {/* Текущий статус */}
      <div>
        {/* Заголовок сезона */}
        {season && (
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Сезон {season.weekNumber}</h2>
            <div className="flex items-center gap-1 text-sm text-[var(--gray-11)]">
              <HugeiconsIcon icon={Clock01Icon} size={14} />
              <span>{timeLeft || '—'}</span>
            </div>
          </div>
        )}

        <LeagueScroll
          currentTier={progress.tier}
          className="mb-4"
        />

        {stats && <LeagueProgress stats={stats} tier={progress.tier} />}
      </div>

      {/* Таблица лидеров */}
      <LeaderboardList
        leaderboard={leaderboard}
        tier={progress.tier}
      />
    </div>
  );
}

function LeaderboardList({ leaderboard, tier }: { leaderboard: LeaderboardEntry[]; tier: LeagueTier }) {
  const zones = useMemo(() => getZones(tier), [tier]);
  const grouped = useMemo(() => groupByZones(leaderboard, tier), [leaderboard, tier]);

  return (
    <div className="flex flex-col gap-4">
      {zones.map((zone) => {
        const entries = grouped[zone.id];

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
              {zone.reward && (
                <span
                  className="shrink-0 text-xs font-medium"
                  style={{ color: zone.color }}
                >
                  {zone.reward}
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
                    entry.isCurrentUser && 'bg-[var(--gray-5)]',
                  )}
                >
                  {/* Позиция и изменение */}
                  <div className="flex w-8 flex-col items-center">
                    <span
                      className="font-bold"
                      style={{ color: zone.id !== 'maintain' ? zone.color : undefined }}
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

                  <Avatar src={entry.avatarUrl} fallback={entry.firstName} size={40} />

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
