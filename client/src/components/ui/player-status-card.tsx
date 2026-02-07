import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeagueStore } from '@/stores/league-store';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { isProtectedTier, getLeagueZoneInfo } from '@/lib/league-config';
import { xpForLevel } from '@/lib/progression-config';
import type { LeagueTier } from '@/types/api';

const LEAGUE_NAMES: Record<LeagueTier, string> = {
  bronze: 'Бронза',
  silver: 'Серебро',
  gold: 'Золото',
  amber: 'Янтарь',
  sapphire: 'Сапфир',
  amethyst: 'Аметист',
  topaz: 'Топаз',
  ruby: 'Рубин',
  legend: 'Легенда',
};

function formatTimeLeft(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  if (diff <= 0) return '0ч';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}д ${hours}ч`;
  return `${hours}ч`;
}


type PlayerStatusCardProps = {
  user: {
    level: number;
    xp: number;
  };
  className?: string;
};

export function PlayerStatusCard({ user, className }: PlayerStatusCardProps) {
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Обновляем таймер каждую минуту
  useEffect(() => {
    if (!season?.startedAt) return;

    // Сезон длится 7 дней
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);

    const updateTimer = () => setTimeLeft(formatTimeLeft(endDate));
    updateTimer();

    const interval = setInterval(updateTimer, 60 * 1000);
    return () => clearInterval(interval);
  }, [season?.startedAt]);

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  if (isLoading || !progress) {
    return <Skeleton className={cn('h-24 w-full rounded-2xl', className)} />;
  }

  const leagueZone = stats
    ? getLeagueZoneInfo(progress.tier, stats.leaguePoints)
    : null;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-stretch gap-4">
        {/* Левая часть — уровень и XP */}
        <div className="flex flex-1 flex-col justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-[var(--accent-11)]">{user.level}</span>
            <span className="text-sm text-[var(--gray-11)]">ур.</span>
          </div>
          <div className="mt-2">
            <Progress value={progressPercent} className="h-2" />
            <span className="mt-1 block text-xs text-[var(--gray-11)]">
              {user.xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP
            </span>
          </div>
        </div>

        {/* Разделитель */}
        <div className="w-px bg-[var(--gray-6)]" />

        {/* Правая часть — лига */}
        <Link to="/leaderboard" className="flex flex-1 flex-col justify-between">
          {/* Верх: бейдж лиги + результат */}
          <div className="flex items-center gap-1">
            {(() => {
              const IconComponent = LEAGUE_ICONS[progress.tier];
              return <IconComponent size={32} className="shrink-0" />;
            })()}
            <span className="text-sm font-semibold">{LEAGUE_NAMES[progress.tier]}</span>
            {leagueZone ? (
              <span
                className={cn(
                  'ml-auto text-sm font-medium',
                  leagueZone.zone === 'promotion' && 'text-[var(--green-11)]',
                  leagueZone.zone === 'demotion' && 'text-[var(--red-11)]',
                  leagueZone.zone === 'maintain' && 'text-[var(--gray-11)]',
                )}
              >
                {leagueZone.tierChange > 0 && '+'}
                {leagueZone.tierChange !== 0 ? leagueZone.tierChange : '±0'}
              </span>
            ) : (
              <span className="ml-auto text-sm text-[var(--gray-11)]">—</span>
            )}
          </div>

          {/* Середина: прогресс-бар с зонами */}
          <div className="mt-2">
            <div className="relative h-2 w-full">
              <div className="absolute inset-0 flex overflow-hidden rounded-full">
                {!isProtectedTier(progress.tier) ? (
                  <>
                    <div
                      className="h-full w-1/3"
                      style={{ backgroundColor: leagueZone?.zone === 'demotion' ? 'var(--red-9)' : 'var(--red-6)' }}
                    />
                    <div
                      className="h-full w-1/3"
                      style={{ backgroundColor: leagueZone?.zone === 'maintain' ? 'var(--gray-9)' : 'var(--gray-6)' }}
                    />
                    <div
                      className="h-full w-1/3"
                      style={{ backgroundColor: leagueZone?.zone === 'promotion' ? 'var(--green-9)' : 'var(--green-6)' }}
                    />
                  </>
                ) : (
                  <>
                    <div
                      className="h-full w-2/3"
                      style={{ backgroundColor: leagueZone?.zone === 'maintain' ? 'var(--gray-9)' : 'var(--gray-6)' }}
                    />
                    <div
                      className="h-full w-1/3"
                      style={{ backgroundColor: leagueZone?.zone === 'promotion' ? 'var(--green-9)' : 'var(--green-6)' }}
                    />
                  </>
                )}
              </div>
              {/* Маркер позиции игрока */}
              {leagueZone && (
                <div
                  className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-white shadow"
                  style={{ left: `clamp(2px, ${leagueZone.positionPercent}%, calc(100% - 2px))` }}
                />
              )}
            </div>
            {/* Низ: LP слева, таймер справа */}
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xs text-[var(--gray-11)]">
                {stats ? stats.leaguePoints : 0} LP
              </span>
              <div className="flex items-center gap-0.5 text-xs text-[var(--gray-11)]">
                <HugeiconsIcon icon={Clock01Icon} size={12} />
                <span>{timeLeft || '—'}</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </Card>
  );
}
