import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUsers, getGeneralStats } from '@/lib/api';
import type { UsersListResponse, GeneralStats } from '@/types/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

const SORTABLE_COLUMNS = [
  { key: 'id', label: 'ID' },
  { key: 'firstName', label: 'Имя' },
  { key: 'level', label: 'Ур.' },
  { key: 'xp', label: 'XP' },
  { key: 'gems', label: 'Гемы' },
  { key: 'streakDays', label: 'Streak' },
  { key: 'createdAt', label: 'Регистрация' },
  { key: 'lastActivityAt', label: 'Последняя акт.' },
] as const;

const LEAGUE_COLORS: Record<string, string> = {
  bronze: 'bg-[var(--bronze-3)] text-[var(--bronze-11)]',
  silver: 'bg-[var(--gray-3)] text-[var(--gray-11)]',
  gold: 'bg-[var(--yellow-3)] text-[var(--yellow-11)]',
  amber: 'bg-[var(--amber-3)] text-[var(--amber-11)]',
  sapphire: 'bg-[var(--blue-3)] text-[var(--blue-11)]',
  amethyst: 'bg-[var(--purple-3)] text-[var(--purple-11)]',
  topaz: 'bg-[var(--orange-3)] text-[var(--orange-11)]',
  ruby: 'bg-[var(--red-3)] text-[var(--red-11)]',
  legend: 'bg-[var(--pink-3)] text-[var(--pink-11)]',
};

export function UsersPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<UsersListResponse | null>(null);
  const [general, setGeneral] = useState<GeneralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout>>();

  const fetchUsers = useCallback(async (p: number, s: string, sortBy: string, ord: string) => {
    setLoading(true);
    try {
      const result = await getUsers({ page: p, search: s || undefined, sort: sortBy, order: ord });
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getGeneralStats().then(setGeneral);
  }, []);

  useEffect(() => {
    fetchUsers(page, search, sort, order);
  }, [page, sort, order, fetchUsers]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      setPage(1);
      fetchUsers(1, value, sort, order);
    }, 400);
    setSearchTimeout(timeout);
  };

  const handleSort = (key: string) => {
    if (sort === key) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(key);
      setOrder('desc');
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Пользователи</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Всего</p>
            <p className="text-2xl font-bold">{general?.totalUsers ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Активных сегодня</p>
            <p className="text-2xl font-bold">{general?.activeToday ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-[var(--muted-foreground)]">Активных за неделю</p>
            <p className="text-2xl font-bold">{general?.activeWeek ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          placeholder="Поиск по имени, username или Telegram ID..."
          className="pl-10"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[var(--card)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-3)] text-left">
              <tr>
                {SORTABLE_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-4 py-3 font-medium text-[var(--muted-foreground)] cursor-pointer hover:text-[var(--foreground)] select-none"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sort === col.key && (
                        <ArrowUpDown className="h-3 w-3" />
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Слов</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Квизов</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Acc%</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Лига</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--gray-4)]">
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 12 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-5 w-16" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data?.users.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    Пользователи не найдены
                  </td>
                </tr>
              ) : (
                data?.users.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-[var(--gray-3)] cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/users/${user.id}`)}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{user.id}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-medium">{user.firstName}</span>
                        {user.username && (
                          <span className="ml-1 text-xs text-[var(--muted-foreground)]">@{user.username}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">{user.level}</td>
                    <td className="px-4 py-3">{user.xp}</td>
                    <td className="px-4 py-3">{user.gems}</td>
                    <td className="px-4 py-3">{user.streakDays}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(user.createdAt)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(user.lastActivityAt)}</td>
                    <td className="px-4 py-3">{user.wordsLearned}</td>
                    <td className="px-4 py-3">{user.quizzesCompleted}</td>
                    <td className="px-4 py-3">{user.correctPercent}%</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('text-xs capitalize', LEAGUE_COLORS[user.leagueTier] ?? '')}>
                        {user.leagueTier}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--gray-4)] px-4 py-3 bg-[var(--gray-3)]/50">
            <p className="text-sm text-[var(--muted-foreground)]">
              Стр. {data.page} из {data.totalPages} ({data.total} юзеров)
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
