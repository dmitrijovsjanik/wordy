import { UsersRound, Activity, Gamepad2, Swords, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { GeneralStats } from '@/types/admin';

type StatCard = {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

export function GeneralStatsSection({ data }: { data: GeneralStats }) {
  const cards: StatCard[] = [
    { label: 'Всего пользователей', value: data.totalUsers, icon: UsersRound, color: 'text-blue-600' },
    { label: 'Активных сегодня', value: data.activeToday, icon: Activity, color: 'text-green-600' },
    { label: 'Активных за неделю', value: data.activeWeek, icon: Activity, color: 'text-emerald-600' },
    { label: 'Всего квизов', value: data.totalQuizzes, icon: Gamepad2, color: 'text-purple-600' },
    { label: 'Завершённых дуэлей', value: data.totalDuels, icon: Swords, color: 'text-orange-600' },
    { label: 'Средний streak', value: data.avgStreak, icon: Flame, color: 'text-red-500' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <span className="text-xs text-[var(--muted-foreground)]">{card.label}</span>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
