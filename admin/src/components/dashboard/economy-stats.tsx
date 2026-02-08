import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gem, Snowflake, TrendingUp } from 'lucide-react';
import type { EconomyStats } from '@/types/admin';

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 12,
  border: '1px solid var(--gray-4)',
  backgroundColor: 'var(--gray-2)',
};

export function EconomyStatsSection({ data }: { data: EconomyStats }) {
  const cards = [
    { label: 'Всего гемов', value: data.totalGems.toLocaleString('ru-RU'), icon: Gem, iconBg: 'bg-[var(--blue-3)]', iconColor: 'text-[var(--blue-11)]' },
    { label: 'Среднее на юзера', value: data.avgGems, icon: TrendingUp, iconBg: 'bg-[var(--green-3)]', iconColor: 'text-[var(--green-11)]' },
    { label: 'Всего freeze', value: data.totalFreezes, icon: Snowflake, iconBg: 'bg-[var(--blue-3)]', iconColor: 'text-[var(--blue-11)]' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Экономика</h2>

      <div className="grid grid-cols-3 gap-4">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Распределение гемов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.gemsDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-4)" />
                <XAxis dataKey="bucket" fontSize={11} stroke="var(--gray-8)" />
                <YAxis fontSize={11} stroke="var(--gray-8)" />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Юзеров" fill="var(--blue-9)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
