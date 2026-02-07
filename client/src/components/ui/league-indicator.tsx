import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeagueStore } from '@/stores/league-store';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';
import { Skeleton } from '@/components/ui/skeleton';
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

export function LeagueIndicator() {
  const navigate = useNavigate();
  const { progress, stats, isLoading, fetchStatus } = useLeagueStore();

  useEffect(() => {
    if (!progress) {
      fetchStatus();
    }
  }, [progress, fetchStatus]);

  if (isLoading || !progress) {
    return <Skeleton className="h-12 w-28 rounded-full" />;
  }

  const IconComponent = LEAGUE_ICONS[progress.tier];
  const leagueName = LEAGUE_NAMES[progress.tier];

  return (
    <button
      onClick={() => navigate('/leaderboard')}
      className="flex h-12 items-center gap-1 rounded-full bg-[var(--gray-3)] pl-2 pr-3 active:bg-[var(--gray-4)]"
    >
      <IconComponent size={32} className="shrink-0" />
      <div className="flex flex-col items-start leading-tight">
        <span className="text-[12px] font-semibold text-[var(--gray-12)]">
          {leagueName}
        </span>
        <span className="text-[11px] text-[var(--gray-11)]">
          {stats?.leaguePoints ?? 0} LP
        </span>
      </div>
    </button>
  );
}
