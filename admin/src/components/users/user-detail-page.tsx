import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUserDetail, getUserActivity, getUserWords } from '@/lib/api';
import type { UserDetailResponse, UserActivityResponse, UserWordsResponse } from '@/types/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Gem, Gift } from 'lucide-react';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { GiveGemsDialog } from './give-gems-dialog';

const STAGE_LABELS = ['Новое', 'Стадия 1', 'Стадия 2', 'Выучено'];
const STAGE_COLORS = ['bg-[var(--gray-3)] text-[var(--gray-11)]', 'bg-[var(--blue-3)] text-[var(--blue-11)]', 'bg-[var(--amber-3)] text-[var(--amber-11)]', 'bg-[var(--green-3)] text-[var(--green-11)]'];

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = Number(id);

  const [detail, setDetail] = useState<UserDetailResponse | null>(null);
  const [activity, setActivity] = useState<UserActivityResponse | null>(null);
  const [words, setWords] = useState<UserWordsResponse | null>(null);
  const [tab, setTab] = useState<'quizzes' | 'words'>('quizzes');
  const [gemsDialogOpen, setGemsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getUserDetail(userId).then(setDetail),
      getUserActivity(userId).then(setActivity),
      getUserWords(userId).then(setWords),
    ]).finally(() => setLoading(false));
  }, [userId]);

  const handleGemsSuccess = (newGems: number) => {
    if (detail) {
      setDetail({
        ...detail,
        user: { ...detail.user, gems: newGems },
      });
    }
  };

  if (loading || !detail) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  const { user, league, quizStats, duelStats } = detail;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/users')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{user.firstName}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">
            {user.username ? `@${user.username}` : ''} | TG: {user.telegramId} | ID: {user.id}
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Уровень</p>
            <p className="text-2xl font-bold">{user.level}</p>
            <p className="text-xs text-[var(--muted-foreground)]">{user.xp} XP</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Гемы</p>
            <p className="text-2xl font-bold flex items-center justify-center gap-1">
              <Gem className="h-4 w-4 text-[var(--blue-9)]" />
              {user.gems}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Streak</p>
            <p className="text-2xl font-bold">{user.streakDays}</p>
            <p className="text-xs text-[var(--muted-foreground)]">макс: {user.maxStreakDays}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Слов выучено</p>
            <p className="text-2xl font-bold">{detail.wordsLearned}</p>
            <p className="text-xs text-[var(--muted-foreground)]">в процессе: {detail.wordsInProgress}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Квизов</p>
            <p className="text-2xl font-bold">{quizStats.totalSessions}</p>
            <p className="text-xs text-[var(--muted-foreground)]">accuracy: {quizStats.correctPercent}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">Дуэли</p>
            <p className="text-2xl font-bold">{duelStats.won}/{duelStats.total}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              <Badge variant="outline" className="text-xs capitalize">{league.tier}</Badge>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={() => setGemsDialogOpen(true)} className="gap-2">
          <Gift className="h-4 w-4" />
          Выдать гемы
        </Button>
      </div>

      {/* Info row */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <span className="text-[var(--muted-foreground)]">Регистрация:</span>
              <p className="font-medium">{formatDate(user.createdAt)}</p>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">Последняя активность:</span>
              <p className="font-medium">{formatDateTime(user.lastActivityAt)}</p>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">Freeze:</span>
              <p className="font-medium">{user.streakFreezes} шт.</p>
            </div>
            <div>
              <span className="text-[var(--muted-foreground)]">Лучший streak ответов:</span>
              <p className="font-medium">{user.bestAnswerStreak}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SRS stages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">SRS стадии</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {detail.userStages.map((s) => (
              <div key={s.stage} className="text-center">
                <Badge className={cn('text-xs', STAGE_COLORS[s.stage] ?? '')} variant="secondary">
                  {STAGE_LABELS[s.stage] ?? `S${s.stage}`}
                </Badge>
                <p className="mt-1 text-lg font-bold">{s.count}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-full bg-[var(--gray-3)] p-1 w-fit">
        <button
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
            tab === 'quizzes' ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          )}
          onClick={() => setTab('quizzes')}
        >
          История квизов
        </button>
        <button
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer',
            tab === 'words' ? 'bg-[var(--background)] text-[var(--foreground)] shadow-sm' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]',
          )}
          onClick={() => setTab('words')}
        >
          Прогресс по словам
        </button>
      </div>

      {/* Tab content */}
      {tab === 'quizzes' && activity && (
        <div className="rounded-2xl bg-[var(--card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-3)] text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">ID</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Тип</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Результат</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">XP</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Дата</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--gray-4)]">
              {activity.sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    Нет данных
                  </td>
                </tr>
              ) : (
                activity.sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{s.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {s.correctCount}/{s.totalCount}
                      {s.totalCount > 0 && (
                        <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                          ({Math.round(s.correctCount / s.totalCount * 100)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">+{s.xpEarned}</td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(s.startedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'words' && words && (
        <div className="rounded-2xl bg-[var(--card)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--gray-3)] text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Слово</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Перевод</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">POS</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">SRS</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">+/-</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Выучено</th>
                <th className="px-4 py-3 font-medium text-[var(--muted-foreground)]">Посл. просмотр</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--gray-4)]">
              {words.words.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted-foreground)]">
                    Нет данных
                  </td>
                </tr>
              ) : (
                words.words.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-3 font-medium">{w.wordText}</td>
                    <td className="px-4 py-3">{w.translation}</td>
                    <td className="px-4 py-3 text-xs">{w.partOfSpeech}</td>
                    <td className="px-4 py-3">
                      <Badge className={cn('text-xs', STAGE_COLORS[w.srsStage] ?? '')} variant="secondary">
                        {w.srsStage}
                      </Badge>
                      {w.hasPenalty && <span className="ml-1 text-xs text-[var(--amber-11)]" title="Штраф">!</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-[var(--green-11)]">{w.correctCount}</span>
                      /
                      <span className="text-[var(--red-11)]">{w.incorrectCount}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{w.masteredAt ? formatDate(w.masteredAt) : '—'}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(w.lastSeenAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <GiveGemsDialog
        userId={userId}
        open={gemsDialogOpen}
        onOpenChange={setGemsDialogOpen}
        onSuccess={handleGemsSuccess}
      />
    </div>
  );
}
