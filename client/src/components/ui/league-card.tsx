import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLeagueStore } from '@/stores/league-store';
import { LeagueBadge } from '@/components/ui/league-badge';
import { LeagueProgress } from '@/components/ui/league-progress';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type LeagueCardProps = {
  className?: string;
};

export function LeagueCard({ className }: LeagueCardProps) {
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (isLoading) {
    return <Skeleton className={cn('h-40 w-full rounded-2xl', className)} />;
  }

  if (!progress) {
    return null;
  }

  return (
    <Card className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between">
        <LeagueBadge tier={progress.tier} size="lg" />
        {season && (
          <span className="text-xs text-[var(--gray-11)]">
            Сезон {season.weekNumber}
          </span>
        )}
      </div>

      {stats ? (
        <LeagueProgress stats={stats} tier={progress.tier} />
      ) : (
        <div className="text-center text-sm text-[var(--gray-11)]">
          Начните играть, чтобы заработать очки лиги
        </div>
      )}

      <Link to="/leaderboard">
        <Button variant="secondary" className="w-full">
          Таблица лидеров
        </Button>
      </Link>
    </Card>
  );
}
