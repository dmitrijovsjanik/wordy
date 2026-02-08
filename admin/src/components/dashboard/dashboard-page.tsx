import { useEffect, useState } from 'react';
import { getGeneralStats, getActivityStats, getEconomyStats, getSrsStats } from '@/lib/api';
import type { GeneralStats, ActivityStats, EconomyStats, SrsStats } from '@/types/admin';
import { GeneralStatsSection } from './general-stats';
import { ActivityChartsSection } from './activity-charts';
import { EconomyStatsSection } from './economy-stats';
import { SrsStatsSection } from './srs-stats';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardPage() {
  const [general, setGeneral] = useState<GeneralStats | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [economy, setEconomy] = useState<EconomyStats | null>(null);
  const [srs, setSrs] = useState<SrsStats | null>(null);
  const [activityDays, setActivityDays] = useState(30);

  useEffect(() => {
    getGeneralStats().then(setGeneral);
    getEconomyStats().then(setEconomy);
    getSrsStats().then(setSrs);
  }, []);

  useEffect(() => {
    getActivityStats(activityDays).then(setActivity);
  }, [activityDays]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Дашборд</h1>

      {general ? <GeneralStatsSection data={general} /> : <LoadingCards count={6} />}

      <ActivityChartsSection
        data={activity}
        days={activityDays}
        onDaysChange={setActivityDays}
      />

      {economy ? <EconomyStatsSection data={economy} /> : <LoadingCards count={3} />}

      {srs ? <SrsStatsSection data={srs} /> : <LoadingCards count={4} />}
    </div>
  );
}

function LoadingCards({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-xl" />
      ))}
    </div>
  );
}
