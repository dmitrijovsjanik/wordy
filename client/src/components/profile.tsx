import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { getMyStats } from '@/lib/api';
import type { UserStats } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { Switch } from '@/components/ui/switch';
import { LeagueCard } from '@/components/ui/league-card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Fire02Icon, Target02Icon, GameController01Icon, Award01Icon, Sun01Icon, Moon02Icon, ComputerIcon, UserGroupIcon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { useThemeStore } from '@/stores/theme-store';
import { useFriendStore } from '@/stores/friend-store';
import { cn } from '@/lib/utils';
import { Avatar } from '@/components/ui/avatar';
import { xpForLevel } from '@/lib/progression-config';

const LANGUAGES = [
  { code: 'ru', name: 'Русский', flag: '\u{1F1F7}\u{1F1FA}', available: true },
  { code: 'en', name: 'English', flag: '\u{1F1EC}\u{1F1E7}', available: true },
  { code: 'es', name: 'Espa\u00f1ol', flag: '\u{1F1EA}\u{1F1F8}', available: false },
  { code: 'de', name: 'Deutsch', flag: '\u{1F1E9}\u{1F1EA}', available: false },
  { code: 'fr', name: 'Fran\u00e7ais', flag: '\u{1F1EB}\u{1F1F7}', available: false },
] as const;

type LanguageDropdownProps = {
  label: string;
  value: string;
  excludeCode: string;
};

function LanguageDropdown({ label, value, excludeCode }: LanguageDropdownProps) {
  const current = LANGUAGES.find((l) => l.code === value);

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium text-[var(--gray-11)]">{label}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl bg-[var(--gray-3)] px-3 py-2 text-sm font-medium outline-none active:bg-[var(--gray-4)]"
          >
            <span>{current?.flag}</span>
            <span>{current?.name}</span>
            <span className="text-[var(--gray-11)]">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {LANGUAGES.filter((l) => l.code !== excludeCode).map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              disabled={!lang.available}
              className={cn(
                !lang.available && 'opacity-50',
                lang.code === value && 'text-[var(--brand-11)] font-medium',
              )}
            >
              <span>{lang.flag}</span>
              <span className="flex-1">{lang.name}</span>
              {!lang.available && (
                <Badge variant="secondary" className="text-[10px]">soon</Badge>
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function Profile() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const toggleRepeatMastered = useUserStore((s) => s.toggleRepeatMastered);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [stats, setStats] = useState<UserStats | null>(null);
  const requestCount = useFriendStore((s) => s.requestCount);
  const fetchRequests = useFriendStore((s) => s.fetchRequests);

  useBackButton(useCallback(() => navigate('/'), [navigate]));

  useEffect(() => {
    getMyStats().then(setStats).catch(() => {});
    fetchRequests();
  }, [fetchRequests]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  return (
    <div className="flex flex-col px-4 pt-6 pb-4">
      {/* Back */}
      <div className="mb-4">
        <BackButton to="/" />
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center">
        <Avatar src={user.avatarUrl} fallback={user.firstName} size={80} />
        <h1 className="mt-3 text-xl font-bold">{user.firstName}</h1>
        {user.username && (
          <span className="text-sm text-[var(--gray-11)]">@{user.username}</span>
        )}
      </div>

      {/* Level + XP */}
      <Card className="mt-6">
        <div className="flex items-center justify-between">
          <Badge>Уровень {user.level}</Badge>
          <span className="text-sm font-medium">{user.xp} XP</span>
        </div>
        <Progress value={progressPercent} className="mt-3" />
        <div className="mt-1 flex justify-between text-xs text-[var(--gray-11)]">
          <span>{currentLevelXp} XP</span>
          <span>{nextLevelXp} XP</span>
        </div>
      </Card>

      {/* League */}
      <LeagueCard className="mt-4" />

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

      {/* Theme */}
      <Card className="mt-4">
        <span className="text-sm text-[var(--gray-11)]">Тема</span>
        <div className="mt-3 flex gap-2">
          {([
            { value: 'light' as const, icon: Sun01Icon, label: 'Светлая' },
            { value: 'dark' as const, icon: Moon02Icon, label: 'Тёмная' },
            { value: 'system' as const, icon: ComputerIcon, label: 'Система' },
          ]).map((item) => (
            <Button
              key={item.value}
              variant={theme === item.value ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setTheme(item.value)}
              className={cn('flex-1 flex-col gap-1.5 text-xs')}
            >
              <HugeiconsIcon strokeWidth={2} icon={item.icon} size={20} />
              {item.label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Language */}
      <Card className="mt-4">
        <span className="text-sm text-[var(--gray-11)]">Язык</span>
        <div className="mt-3 flex flex-col gap-2">
          <LanguageDropdown
            label="Родной"
            value={user.nativeLanguage}
            excludeCode={user.learningLanguage}
          />
          <LanguageDropdown
            label="Изучаю"
            value={user.learningLanguage}
            excludeCode={user.nativeLanguage}
          />
        </div>
      </Card>

      {/* Quiz Settings */}
      <Card className="mt-4">
        <span className="text-sm text-[var(--gray-11)]">Квиз</span>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Повторять выученные слова</span>
            <span className="text-xs text-[var(--gray-11)]">Выученные слова будут возвращаться раз в 3 месяца</span>
          </div>
          <Switch
            checked={user.repeatMastered}
            onCheckedChange={() => toggleRepeatMastered()}
          />
        </div>
      </Card>

      {/* Stats */}
      {stats ? (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Card className="flex flex-col items-center">
            <HugeiconsIcon strokeWidth={2} icon={GameController01Icon} size={20} className="text-[var(--gray-11)]" />
            <span className="mt-2 text-xl font-bold">{stats.totalGames}</span>
            <span className="text-xs text-[var(--gray-11)]">Игр</span>
          </Card>
          <Card className="flex flex-col items-center">
            <HugeiconsIcon strokeWidth={2} icon={Target02Icon} size={20} className="text-[var(--gray-11)]" />
            <span className="mt-2 text-xl font-bold">{stats.correctPercent}%</span>
            <span className="text-xs text-[var(--gray-11)]">Точность</span>
          </Card>
          <Card className="flex flex-col items-center">
            <HugeiconsIcon strokeWidth={2} icon={Award01Icon} size={20} className="text-[var(--gray-11)]" />
            <span className="mt-2 text-xl font-bold">{stats.totalCorrect}</span>
            <span className="text-xs text-[var(--gray-11)]">Правильных</span>
          </Card>
          <Card className="flex flex-col items-center">
            <HugeiconsIcon strokeWidth={2} icon={Fire02Icon} size={20} className="text-[var(--gray-11)]" />
            <span className="mt-2 text-xl font-bold">{stats.bestStreak}</span>
            <span className="text-xs text-[var(--gray-11)]">Лучшая серия</span>
          </Card>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      )}
    </div>
  );
}
