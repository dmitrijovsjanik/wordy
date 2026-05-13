import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useLeagueStore } from '@/stores/league-store';
import { useBackButton } from '@/hooks/use-back-button';
import { getMyStats } from '@/lib/api';
import type { UserStats } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatProgress } from '@/components/ui/stat-progress';
import { BackButton } from '@/components/ui/back-button';
import { LeagueBadge, getLeagueName } from '@/components/ui/league-badge';
import { StreakDaysIndicator } from '@/components/ui/streak-days-indicator';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Tick01Icon,
  ZapIcon,
  UserGroupIcon,
  ArrowRight01Icon,
  StarIcon,
} from '@hugeicons/core-free-icons';
import { useFriendStore } from '@/stores/friend-store';
import { Avatar } from '@/components/ui/avatar';
import { xpForLevel } from '@/lib/progression-config';
import { PILOT_FEATURES } from '@/lib/pilot-config';
import Lottie from 'lottie-react';
import fireStreakData from '@/assets/fire-streak.json';
import { CefrProgress } from '@/components/profile/cefr-progress';

const MONTHS_RU = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatJoinDate(dateStr: string): string {
  const date = new Date(dateStr);
  return `${MONTHS_RU[date.getMonth()]} ${date.getFullYear()}`;
}

export function Profile() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const [stats, setStats] = useState<UserStats | null>(null);
  const requestCount = useFriendStore((s) => s.requestCount);
  const fetchRequests = useFriendStore((s) => s.fetchRequests);
  const progress = useLeagueStore((s) => s.progress);
  const fetchStatus = useLeagueStore((s) => s.fetchStatus);

  useBackButton(useCallback(() => navigate('/'), [navigate]));

  useEffect(() => {
    getMyStats().then(setStats).catch(() => {});
    if (PILOT_FEATURES.friends) fetchRequests();
    if (PILOT_FEATURES.leagues) fetchStatus();
  }, [fetchRequests, fetchStatus]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const currentTier = progress?.tier ?? 'bronze';

  return (
    <div className="flex flex-col px-4 pt-4 pb-4">
      <div className="flex items-center">
        <BackButton to="/" variant="ghost" />
      </div>

      {/* Avatar + Name */}
      <div className="mt-4 flex flex-col items-center">
        <Avatar src={user.avatarUrl} fallback={user.firstName} size={80} />
        <h1 className="mt-3 text-xl font-bold">{user.firstName}</h1>
        {user.username && (
          <span className="text-sm text-[var(--gray-11)]">@{user.username}</span>
        )}
      </div>

      {/* Current Info Pills */}
      <div className="mt-5 flex justify-center gap-1.5">
        <StreakDaysIndicator count={user.streakDays} />
        {PILOT_FEATURES.leagues && (
          <div className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--gray-3)] pl-1 pr-3">
            <LeagueBadge tier={currentTier} size="sm" showLabel={false} />
            <span className="text-xs font-semibold">{getLeagueName(currentTier)}</span>
          </div>
        )}
      </div>

      {/* XP Progress */}
      <StatProgress
        label={`Уровень ${user.level}`}
        value={`${user.xp - currentLevelXp} / ${nextLevelXp - currentLevelXp} XP`}
        percent={progressPercent}
        className="mt-5"
      />

      {/* Records Grid */}
      {stats ? (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {PILOT_FEATURES.leagues && (
            <Card className="flex flex-col items-center py-3 px-2">
              {stats.maxLeagueTier ? (
                <LeagueBadge tier={stats.maxLeagueTier} size="sm" showLabel={false} />
              ) : (
                <HugeiconsIcon strokeWidth={2} icon={StarIcon} size={20} className="text-[var(--gray-9)]" />
              )}
              <span className="mt-1.5 text-sm font-bold">
                {stats.maxLeagueTier ? getLeagueName(stats.maxLeagueTier) : '—'}
              </span>
              <span className="text-[10px] text-[var(--gray-11)]">Макс. лига</span>
            </Card>
          )}

          <Card className="flex flex-col items-center py-3 px-2">
            <div className="h-6 w-6 shrink-0">
              <Lottie animationData={fireStreakData} loop autoplay className="relative -top-1 h-7 w-7 -mx-0.5" />
            </div>
            <span className="mt-1 text-sm font-bold">{stats.maxStreakDays}</span>
            <span className="text-[10px] text-[var(--gray-11)]">Макс. стрик дней</span>
          </Card>

          <Card className="flex flex-col items-center py-3 px-2">
            <HugeiconsIcon strokeWidth={2} icon={ZapIcon} size={20} className="text-yellow-500" />
            <span className="mt-1.5 text-sm font-bold">{stats.bestAnswerStreak}</span>
            <span className="text-[10px] text-[var(--gray-11)]">Макс. стрик ответов</span>
          </Card>

          <Card className="flex flex-col items-center py-3 px-2">
            <HugeiconsIcon strokeWidth={2} icon={Tick01Icon} size={20} className="text-[var(--brand-9)]" />
            <span className="mt-1.5 text-sm font-bold">{stats.wordsLearned}</span>
            <span className="text-[10px] text-[var(--gray-11)]">Выучено слов</span>
          </Card>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3">
          {Array.from({ length: PILOT_FEATURES.leagues ? 4 : 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}

      {/* Friends */}
      <Card className="mt-4">
        <button
          onClick={() => navigate('/friends')}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <HugeiconsIcon strokeWidth={2} icon={UserGroupIcon} size={20} className="text-[var(--gray-11)]" />
            <span className="text-sm font-medium">Друзья</span>
          </div>
          <div className="flex items-center gap-2">
            {requestCount > 0 && (
              <Badge variant="error" className="text-[10px]">{requestCount}</Badge>
            )}
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} className="text-[var(--gray-11)]" />
          </div>
        </button>
      </Card>

      {/* CEFR Progress */}
      <CefrProgress className="mt-5" />

      {/* Join date */}
      <p className="mt-6 text-center text-xs text-[var(--gray-10)]">
        Учит слова с {formatJoinDate(user.createdAt)}
      </p>
    </div>
  );
}
