import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gem, Snowflake, TrendingUp } from 'lucide-react';
import type { EconomyStats } from '@/types/admin';

export function EconomyStatsSection({ data }: { data: EconomyStats }) {
  const cards = [
    { label: 'Всего гемов', value: data.totalGems.toLocaleString('ru-RU'), icon: Gem, color: 'text-cyan-600' },
    { label: 'Среднее на юзера', value: data.avgGems, icon: TrendingUp, color: 'text-blue-600' },
    { label: 'Всего freeze', value: data.totalFreezes, icon: Snowflake, color: 'text-sky-600' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Экономика</h2>

      <div className="grid grid-cols-3 gap-4">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Распределение гемов</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.gemsDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="bucket" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                <Bar dataKey="count" name="Юзеров" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
