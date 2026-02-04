import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLeagueStore } from '@/stores/league-store';
import { LeagueBadge } from '@/components/ui/league-badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

type LeagueWidgetProps = {
  className?: string;
};

export function LeagueWidget({ className }: LeagueWidgetProps) {
  const { progress, stats, position, isLoading, fetchStatus } = useLeagueStore();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (isLoading || !progress) {
    return <Skeleton className={cn('h-16 w-full rounded-2xl', className)} />;
  }

  return (
    <Link to="/leaderboard">
      <Card className={cn('flex items-center gap-3 p-3', className)}>
        <LeagueBadge tier={progress.tier} division={progress.division} size="lg" />

        <div className="flex flex-1 flex-col">
          <span className="font-semibold text-lg">
            {stats ? stats.leaguePoints : 0} LP
          </span>
          {position && position.total > 0 && (
            <span className="text-xs text-[var(--gray-11)]">
              #{position.position} из {position.total}
            </span>
          )}
        </div>

        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={20}
          className="text-[var(--gray-11)]"
        />
      </Card>
    </Link>
  );
}
