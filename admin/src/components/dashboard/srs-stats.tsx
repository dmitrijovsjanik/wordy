import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Target, AlertTriangle } from 'lucide-react';
import type { SrsStats } from '@/types/admin';

const STAGE_COLORS = ['#94a3b8', '#3b82f6', '#f59e0b', '#22c55e'];
const STAGE_LABELS = ['Новые (0)', 'Изучаемые (1)', 'Повторяемые (2)', 'Выучено (3)'];

export function SrsStatsSection({ data }: { data: SrsStats }) {
  const cards = [
    { label: 'Слов выучено', value: data.totalLearned, icon: BookOpen, color: 'text-green-600' },
    { label: 'Среднее на юзера', value: data.avgLearnedPerUser, icon: BookOpen, color: 'text-emerald-600' },
    { label: 'Accuracy', value: `${data.accuracy}%`, icon: Target, color: 'text-blue-600' },
    { label: 'Со штрафом', value: data.wordsWithPenalty, icon: AlertTriangle, color: 'text-amber-600' },
  ];

  const pieData = data.stageDistribution.map((item) => ({
    name: STAGE_LABELS[item.stage] ?? `Stage ${item.stage}`,
    value: item.count,
  }));

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Обучение / SRS</h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Распределение по SRS стадиям</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={index} fill={STAGE_COLORS[index] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border)' }} />
                  <Legend fontSize={12} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Общая статистика ответов</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-4">
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Всего ответов</span>
                <span className="font-semibold">{data.totalAnswers.toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Правильных</span>
                <span className="font-semibold text-green-600">{data.correctAnswers.toLocaleString('ru-RU')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Accuracy</span>
                <span className="font-semibold">{data.accuracy}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-[var(--muted-foreground)]">Кастомных слов</span>
                <span className="font-semibold">{data.customWordsTotal}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
