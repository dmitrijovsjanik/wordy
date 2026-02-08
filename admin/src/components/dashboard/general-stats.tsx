import { UsersRound, Activity, Gamepad2, Swords, Flame } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { GeneralStats } from '@/types/admin';

type StatCard = {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
};

export function GeneralStatsSection({ data }: { data: GeneralStats }) {
  const cards: StatCard[] = [
    { label: 'Всего пользователей', value: data.totalUsers, icon: UsersRound, iconBg: 'bg-[var(--blue-3)]', iconColor: 'text-[var(--blue-11)]' },
    { label: 'Активных сегодня', value: data.activeToday, icon: Activity, iconBg: 'bg-[var(--green-3)]', iconColor: 'text-[var(--green-11)]' },
    { label: 'Активных за неделю', value: data.activeWeek, icon: Activity, iconBg: 'bg-[var(--green-3)]', iconColor: 'text-[var(--green-11)]' },
    { label: 'Всего квизов', value: data.totalQuizzes, icon: Gamepad2, iconBg: 'bg-[var(--purple-3)]', iconColor: 'text-[var(--purple-11)]' },
    { label: 'Завершённых дуэлей', value: data.totalDuels, icon: Swords, iconBg: 'bg-[var(--orange-3)]', iconColor: 'text-[var(--orange-11)]' },
    { label: 'Средний streak', value: data.avgStreak, icon: Flame, iconBg: 'bg-[var(--red-3)]', iconColor: 'text-[var(--red-11)]' },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${card.iconBg}`}>
                <card.icon className={`h-4 w-4 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-2xl font-bold">{card.value}</p>
            <span className="text-xs text-[var(--muted-foreground)]">{card.label}</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
