import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ActivityStats } from '@/types/admin';
import { cn } from '@/lib/utils';

const PERIOD_OPTIONS = [7, 14, 30, 60] as const;

type Props = {
  data: ActivityStats | null;
  days: number;
  onDaysChange: (days: number) => void;
};

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const TOOLTIP_STYLE = {
  fontSize: 12,
  borderRadius: 12,
  border: '1px solid var(--gray-4)',
  backgroundColor: 'var(--gray-2)',
};

export function ActivityChartsSection({ data, days, onDaysChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Активность</h2>
        <div className="flex gap-1 rounded-full bg-[var(--gray-3)] p-1">
          {PERIOD_OPTIONS.map((d) => (
            <button
              key={d}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                days === d
                  ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm'
                  : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
              )}
              onClick={() => onDaysChange(d)}
            >
              {d}д
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* DAU / WAU / MAU */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">DAU / WAU / MAU</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dau}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-4)" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatShortDate}
                      fontSize={11}
                      stroke="var(--gray-8)"
                    />
                    <YAxis fontSize={11} stroke="var(--gray-8)" />
                    <Tooltip
                      labelFormatter={(label) => formatShortDate(String(label))}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Line type="monotone" dataKey="count" name="DAU" stroke="var(--brand-9)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Registrations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Новые регистрации</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.registrations}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-4)" />
                    <XAxis dataKey="date" tickFormatter={formatShortDate} fontSize={11} stroke="var(--gray-8)" />
                    <YAxis fontSize={11} stroke="var(--gray-8)" />
                    <Tooltip
                      labelFormatter={(label) => formatShortDate(String(label))}
                      contentStyle={TOOLTIP_STYLE}
                    />
                    <Bar dataKey="count" name="Регистрации" fill="var(--brand-9)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Retention */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Retention</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {Object.entries(data.retention).map(([key, val]) => (
                  <div key={key} className="rounded-2xl bg-[var(--gray-3)] p-4 text-center">
                    <p className="text-xs text-[var(--muted-foreground)] mb-1">
                      {key.replace('day', 'D')}
                    </p>
                    <p className={cn(
                      'text-2xl font-bold',
                      val.rate >= 30 ? 'text-[var(--green-11)]' : val.rate >= 15 ? 'text-[var(--amber-11)]' : 'text-[var(--red-11)]',
                    )}>
                      {val.rate}%
                    </p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-1">
                      {val.retained} / {val.cohortSize}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
