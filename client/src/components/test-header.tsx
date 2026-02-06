import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useLeagueStore } from '@/stores/league-store';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { StreakDaysIndicator } from '@/components/ui/streak-days-indicator';
import { StreakFreezeIndicator } from '@/components/ui/streak-freeze-indicator';
import { GemsIndicator } from '@/components/ui/gems-indicator';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, Notification03Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { PROTECTED_TIERS, getLeagueZoneInfo } from '@/lib/league-config';
import { xpForLevel } from '@/lib/progression-config';
import type { LeagueTier } from '@/types/api';

const LEAGUE_NAMES: Record<LeagueTier, string> = {
  bronze: 'Бронза',
  silver: 'Серебро',
  gold: 'Золото',
  amber: 'Янтарь',
  sapphire: 'Сапфир',
  amethyst: 'Аметист',
  topaz: 'Топаз',
  ruby: 'Рубин',
  legend: 'Легенда',
};
const DIVISION_LABELS = ['I', 'II', 'III'];

function formatTimeLeft(endDate: Date): string {
  const now = new Date();
  const diff = endDate.getTime() - now.getTime();
  if (diff <= 0) return '0ч';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}д ${hours}ч`;
  return `${hours}ч`;
}

// ────────────────────────────────────────────
// Текущий вариант — для сравнения
// ────────────────────────────────────────────
function CurrentHeader() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, position, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const isProtected = progress ? PROTECTED_TIERS.includes(progress.tier) : false;
  const leagueZone = position && position.total > 0 && progress
    ? getLeagueZoneInfo(position.position, position.total, stats?.leaguePoints ?? 0, isProtected)
    : null;

  return (
    <div className="px-4 pt-4">
      {/* Top bar */}
      <div className="mb-2 flex items-center gap-2">
        <button className="flex items-center gap-2">
          <Avatar src={user.avatarUrl} fallback={user.firstName} size={32} />
          <div className="flex flex-col text-left">
            <span className="text-xs text-[var(--gray-11)]">Привет,</span>
            <span className="text-sm font-semibold">{user.firstName}</span>
          </div>
        </button>
        <div className="flex-1" />
        <StreakDaysIndicator count={user.streakDays} />
        <StreakFreezeIndicator count={user.streakFreezes} />
        <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
      </div>
      {/* Card */}
      {isLoading || !progress ? (
        <Skeleton className="h-24 w-full rounded-2xl" />
      ) : (
        <Card className="p-4">
          <div className="flex items-stretch gap-4">
            <div className="flex flex-1 flex-col justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-[var(--accent-11)]">{user.level}</span>
                <span className="text-sm text-[var(--gray-11)]">ур.</span>
              </div>
              <div className="mt-2">
                <Progress value={progressPercent} className="h-2" />
                <span className="mt-1 block text-xs text-[var(--gray-11)]">
                  {user.xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP
                </span>
              </div>
            </div>
            <div className="w-px bg-[var(--gray-6)]" />
            <Link to="/leaderboard" className="flex flex-1 flex-col justify-between">
              <div className="flex items-center gap-1">
                {(() => {
                  const Icon = LEAGUE_ICONS[progress.tier];
                  return <Icon size={32} className="shrink-0" />;
                })()}
                <span className="text-sm font-semibold">{LEAGUE_NAMES[progress.tier]}</span>
                <span className="text-sm text-[var(--gray-11)]">{DIVISION_LABELS[progress.division - 1]}</span>
                {leagueZone ? (
                  <span className={cn(
                    'ml-auto text-sm font-medium',
                    leagueZone.zone === 'promotion_x3' && 'text-[var(--violet-11)]',
                    leagueZone.zone === 'promotion_x2' && 'text-[var(--blue-11)]',
                    leagueZone.zone === 'promotion_x1' && 'text-[var(--green-11)]',
                    leagueZone.zone === 'demotion' && 'text-[var(--red-11)]',
                    leagueZone.zone === 'safe' && 'text-[var(--gray-11)]',
                  )}>
                    {leagueZone.result > 0 && '+'}{leagueZone.result !== 0 ? leagueZone.result : '±0'}
                  </span>
                ) : <span className="ml-auto text-sm text-[var(--gray-11)]">—</span>}
              </div>
              <div className="mt-2">
                <LeagueBar isProtected={isProtected} leagueZone={leagueZone} />
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-xs text-[var(--gray-11)]">{stats?.leaguePoints ?? 0} LP</span>
                  <div className="flex items-center gap-0.5 text-xs text-[var(--gray-11)]">
                    <HugeiconsIcon icon={Clock01Icon} size={12} />
                    <span>{timeLeft || '—'}</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант A — Кольцо прогресса уровня
// Аватар с кольцом прогресса вокруг + компактная строка индикаторов
// ────────────────────────────────────────────
function VariantA() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, position, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const isProtected = progress ? PROTECTED_TIERS.includes(progress.tier) : false;
  const leagueZone = position && position.total > 0 && progress
    ? getLeagueZoneInfo(position.position, position.total, stats?.leaguePoints ?? 0, isProtected)
    : null;

  // Ring SVG params
  const ringSize = 56;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4">
      {/* Top row: ring + name/xp + right indicators */}
      <div className="flex items-center gap-3">
        {/* Ring avatar */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 6} />
          </div>
          {/* Level badge */}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {user.level}
          </div>
        </button>

        {/* Name + XP text */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold truncate">{user.firstName}</span>
          <span className="text-xs text-[var(--gray-11)]">
            {user.xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP
          </span>
        </div>

        {/* Right indicators */}
        <div className="flex items-center gap-1.5">
          <StreakDaysIndicator count={user.streakDays} />
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>

      {/* League row — без Card, просто строка */}
      {!isLoading && progress && (
        <Link to="/leaderboard" className="mt-3 flex items-center gap-2">
          {(() => {
            const Icon = LEAGUE_ICONS[progress.tier];
            return <Icon size={28} className="shrink-0" />;
          })()}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold">{LEAGUE_NAMES[progress.tier]}</span>
              <span className="text-xs text-[var(--gray-11)]">{DIVISION_LABELS[progress.division - 1]}</span>
              <span className="text-xs text-[var(--gray-11)]">·</span>
              <span className="text-xs text-[var(--gray-11)]">{stats?.leaguePoints ?? 0} LP</span>
              {leagueZone && (
                <span className={cn(
                  'ml-auto text-xs font-medium',
                  leagueZone.zone === 'promotion_x3' && 'text-[var(--violet-11)]',
                  leagueZone.zone === 'promotion_x2' && 'text-[var(--blue-11)]',
                  leagueZone.zone === 'promotion_x1' && 'text-[var(--green-11)]',
                  leagueZone.zone === 'demotion' && 'text-[var(--red-11)]',
                  leagueZone.zone === 'safe' && 'text-[var(--gray-11)]',
                )}>
                  {leagueZone.result > 0 && '+'}{leagueZone.result !== 0 ? leagueZone.result : '±0'}
                </span>
              )}
              <div className="ml-auto flex items-center gap-0.5 text-xs text-[var(--gray-11)]">
                <HugeiconsIcon icon={Clock01Icon} size={12} />
                <span>{timeLeft || '—'}</span>
              </div>
            </div>
            <LeagueBar isProtected={isProtected} leagueZone={leagueZone} />
          </div>
        </Link>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант B — Компактный, без контейнера
// Уровень-пилюля в верхнем ряду, прогресс XP под шапкой полной ширины
// ────────────────────────────────────────────
function VariantB() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, position, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const isProtected = progress ? PROTECTED_TIERS.includes(progress.tier) : false;
  const leagueZone = position && position.total > 0 && progress
    ? getLeagueZoneInfo(position.position, position.total, stats?.leaguePoints ?? 0, isProtected)
    : null;

  return (
    <div className="px-4 pt-4">
      {/* Row 1: Avatar + Name | indicators as pills */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-2">
          <Avatar src={user.avatarUrl} fallback={user.firstName} size={32} />
          <span className="text-sm font-semibold">{user.firstName}</span>
        </button>
        <div className="flex-1" />

        {/* Level pill */}
        <div className="flex h-8 items-center gap-1 rounded-full bg-[var(--accent-3)] px-2.5">
          <span className="text-sm font-bold text-[var(--accent-11)]">{user.level}</span>
          <span className="text-[10px] text-[var(--gray-11)]">ур.</span>
        </div>

        <StreakDaysIndicator count={user.streakDays} />
        <StreakFreezeIndicator count={user.streakFreezes} />
        <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
      </div>

      {/* Row 2: Full-width XP bar */}
      <div className="mt-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--gray-11)]">
            {user.xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP до {user.level + 1} ур.
          </span>
        </div>
        <Progress value={progressPercent} className="mt-0.5 h-1.5" />
      </div>

      {/* Row 3: League bar inline */}
      {!isLoading && progress && (
        <Link to="/leaderboard" className="mt-2.5 flex items-center gap-2">
          {(() => {
            const Icon = LEAGUE_ICONS[progress.tier];
            return <Icon size={24} className="shrink-0" />;
          })()}
          <span className="text-xs font-semibold">{LEAGUE_NAMES[progress.tier]}</span>
          <span className="text-[10px] text-[var(--gray-11)]">{DIVISION_LABELS[progress.division - 1]}</span>

          <div className="flex-1">
            <LeagueBar isProtected={isProtected} leagueZone={leagueZone} />
          </div>

          <span className="text-xs text-[var(--gray-11)]">{stats?.leaguePoints ?? 0} LP</span>
          <div className="flex items-center gap-0.5 text-[10px] text-[var(--gray-11)]">
            <HugeiconsIcon icon={Clock01Icon} size={10} />
            <span>{timeLeft || '—'}</span>
          </div>
        </Link>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант C — Большой аватар с кольцом + вся инфа вокруг
// Duolingo-inspired: по центру аватар, вокруг ring, под ним уровень
// Индикаторы и лига по бокам
// ────────────────────────────────────────────
function VariantC() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, position, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const isProtected = progress ? PROTECTED_TIERS.includes(progress.tier) : false;
  const leagueZone = position && position.total > 0 && progress
    ? getLeagueZoneInfo(position.position, position.total, stats?.leaguePoints ?? 0, isProtected)
    : null;

  // Ring params
  const ringSize = 72;
  const strokeWidth = 4;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4">
      {/* Center: Avatar ring + flanking stats */}
      <div className="flex items-center justify-between">
        {/* Left: League */}
        {!isLoading && progress ? (
          <Link to="/leaderboard" className="flex flex-col items-center gap-0.5">
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={36} className="shrink-0" />;
            })()}
            <span className="text-[10px] font-semibold">{LEAGUE_NAMES[progress.tier]}</span>
            <span className="text-[10px] text-[var(--gray-11)]">{stats?.leaguePoints ?? 0} LP</span>
          </Link>
        ) : (
          <Skeleton className="h-12 w-12 rounded-full" />
        )}

        {/* Center: Ring Avatar */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 8} />
          </div>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-2 py-0.5 text-[10px] font-bold text-white leading-none">
            {user.level} ур.
          </div>
        </button>

        {/* Right: Streak + Freeze + Gems vertical */}
        <div className="flex flex-col items-center gap-1.5">
          <StreakDaysIndicator count={user.streakDays} />
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>

      {/* Name */}
      <div className="mt-3 text-center">
        <span className="text-sm font-semibold">{user.firstName}</span>
        <span className="ml-1 text-xs text-[var(--gray-11)]">
          {user.xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP
        </span>
      </div>

      {/* League progress bar inline */}
      {!isLoading && progress && (
        <Link to="/leaderboard" className="mt-2 flex items-center gap-2">
          <div className="flex-1">
            <LeagueBar isProtected={isProtected} leagueZone={leagueZone} />
          </div>
          {leagueZone && (
            <span className={cn(
              'text-xs font-medium',
              leagueZone.zone === 'promotion_x3' && 'text-[var(--violet-11)]',
              leagueZone.zone === 'promotion_x2' && 'text-[var(--blue-11)]',
              leagueZone.zone === 'promotion_x1' && 'text-[var(--green-11)]',
              leagueZone.zone === 'demotion' && 'text-[var(--red-11)]',
              leagueZone.zone === 'safe' && 'text-[var(--gray-11)]',
            )}>
              {leagueZone.result > 0 && '+'}{leagueZone.result !== 0 ? leagueZone.result : '±0'}
            </span>
          )}
          <div className="flex items-center gap-0.5 text-[10px] text-[var(--gray-11)]">
            <HugeiconsIcon icon={Clock01Icon} size={10} />
            <span>{timeLeft || '—'}</span>
          </div>
        </Link>
      )}
    </div>
  );
}


// ────────────────────────────────────────────
// Вариант D — Без league bar, только пилюли
// Всё в одной строке: аватар + кольцо уровня | лига-пилюля | streak | gems
// Под ней — тонкий XP bar на полную ширину
// ────────────────────────────────────────────
function VariantD() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  // Ring params
  const ringSize = 44;
  const strokeWidth = 2.5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4">
      {/* Single row: all pills */}
      <div className="flex items-center gap-1.5">
        {/* Avatar with ring = level progress */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 4} />
          </div>
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-1.5 text-[9px] font-bold text-white leading-[16px]">
            {user.level}
          </div>
        </button>

        <div className="flex-1" />

        {/* League pill — no bar, just icon + LP + timer */}
        {!isLoading && progress && (
          <Link
            to="/leaderboard"
            className="flex h-8 items-center gap-1 rounded-full bg-[var(--gray-3)] pl-1 pr-2.5"
          >
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={24} className="shrink-0" />;
            })()}
            <span className="text-xs font-semibold">{stats?.leaguePoints ?? 0}</span>
            <div className="h-3 w-px bg-[var(--gray-6)]" />
            <div className="flex items-center gap-0.5 text-[10px] text-[var(--gray-11)]">
              <HugeiconsIcon icon={Clock01Icon} size={10} />
              <span>{timeLeft || '—'}</span>
            </div>
          </Link>
        )}

        <StreakDaysIndicator count={user.streakDays} />
        <StreakFreezeIndicator count={user.streakFreezes} />
        <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант E — Кольцо + имя слева, справа: лига число + таймер, streak, gems
// Две строки, но без Card и без league bar
// ────────────────────────────────────────────
function VariantE() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  // Ring params
  const ringSize = 52;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4">
      {/* Row 1: Avatar ring + name | pills */}
      <div className="flex items-center gap-3">
        {/* Avatar with XP ring */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 6} />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {user.level}
          </div>
        </button>

        {/* Name + XP fraction */}
        <div className="flex min-w-0 flex-col">
          <span className="text-sm font-semibold truncate">{user.firstName}</span>
          <span className="text-[11px] text-[var(--gray-11)]">
            {user.xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP
          </span>
        </div>

        <div className="flex-1" />

        {/* Right pills */}
        <div className="flex items-center gap-1.5">
          {/* League pill — compact: icon + LP + timer */}
          {!isLoading && progress && (
            <Link
              to="/leaderboard"
              className="flex h-8 items-center gap-1 rounded-full bg-[var(--gray-3)] pl-1 pr-2.5"
            >
              {(() => {
                const Icon = LEAGUE_ICONS[progress.tier];
                return <Icon size={24} className="shrink-0" />;
              })()}
              <div className="flex flex-col items-start leading-none">
                <span className="text-[11px] font-semibold">{stats?.leaguePoints ?? 0} LP</span>
                <div className="flex items-center gap-0.5 text-[9px] text-[var(--gray-11)]">
                  <HugeiconsIcon icon={Clock01Icon} size={8} />
                  <span>{timeLeft || '—'}</span>
                </div>
              </div>
            </Link>
          )}
          <StreakDaysIndicator count={user.streakDays} />
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант F — Максимально плоский
// Одна строка пилюль: аватар | уровень | лига+LP+таймер | streak | gems
// Ничего лишнего, никаких вторых строк
// ────────────────────────────────────────────
function VariantF() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  return (
    <div className="px-4 pt-4">
      {/* Single row of pills */}
      <div className="flex items-center gap-1.5">
        {/* Avatar */}
        <button className="shrink-0">
          <Avatar src={user.avatarUrl} fallback={user.firstName} size={32} />
        </button>

        {/* Level pill with mini progress inside */}
        <button className="flex h-8 items-center gap-1.5 rounded-full bg-[var(--accent-3)] px-3">
          <span className="text-sm font-bold text-[var(--accent-11)]">{user.level}</span>
          {/* Mini arc: just a tiny bar showing XP progress */}
          <div className="h-1 w-8 overflow-hidden rounded-full bg-[var(--accent-5)]">
            <div
              className="h-full rounded-full bg-[var(--accent-9)] transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </button>

        {/* League pill */}
        {!isLoading && progress && (
          <Link
            to="/leaderboard"
            className="flex h-8 items-center gap-1 rounded-full bg-[var(--gray-3)] pl-1 pr-2.5"
          >
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={24} className="shrink-0" />;
            })()}
            <span className="text-xs font-semibold">{stats?.leaguePoints ?? 0}</span>
            <div className="h-3 w-px bg-[var(--gray-6)]" />
            <div className="flex items-center gap-0.5 text-[10px] text-[var(--gray-11)]">
              <HugeiconsIcon icon={Clock01Icon} size={10} />
              <span>{timeLeft || '—'}</span>
            </div>
          </Link>
        )}

        <div className="flex-1" />

        <StreakDaysIndicator count={user.streakDays} />
        <StreakFreezeIndicator count={user.streakFreezes} />
        <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант G — Кольцо v2: приветствие сверху, уровень инлайн с именем,
// иконка лиги того же размера что аватар (с компенсаторами)
// ────────────────────────────────────────────
function VariantG() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [_timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  // Ring SVG params — same size as league icon area
  const ringSize = 52;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  // League icon visual size matches avatar
  const leagueIconSize = 44;
  // Compensator padding to align league icon container with ring container
  const leagueCompensator = (ringSize - leagueIconSize) / 2;

  return (
    <div className="px-4 pt-4">
      {/* Greeting */}
      <span className="text-xs text-[var(--gray-11)]">Привет,</span>

      {/* Main row */}
      <div className="mt-1 flex items-center gap-3">
        {/* Avatar with XP ring */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 6} />
          </div>
        </button>

        {/* Name + level inline */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{user.firstName}</span>
            <div className="rounded-full bg-[var(--brand-9)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
              {user.level} ур.
            </div>
          </div>
        </div>

        {/* League icon — same visual weight as avatar */}
        {!isLoading && progress && (
          <Link
            to="/leaderboard"
            className="relative shrink-0 flex items-center justify-center"
            style={{ width: ringSize, height: ringSize, padding: leagueCompensator }}
          >
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={leagueIconSize} className="shrink-0" />;
            })()}
            {/* LP badge under league icon */}
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--gray-12)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--gray-1)] leading-none">
              {stats?.leaguePoints ?? 0}
            </div>
          </Link>
        )}

        {/* Right indicators */}
        <div className="flex items-center gap-1.5">
          <StreakDaysIndicator count={user.streakDays} />
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант H — Аватар с бейджами в углах:
// Уровень (с мини-кольцом прогресса) — левый нижний угол
// Лига — правый нижний угол
// Приветствие + имя, индикаторы справа
// ────────────────────────────────────────────
function VariantH() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const avatarSize = 52;

  // Level badge ring params
  const badgeRingSize = 28;
  const badgeStrokeWidth = 2.5;
  const badgeRadius = (badgeRingSize - badgeStrokeWidth) / 2;
  const badgeCircumference = 2 * Math.PI * badgeRadius;
  const badgeStrokeDashoffset = badgeCircumference - (progressPercent / 100) * badgeCircumference;

  return (
    <div className="px-4 pt-4">
      {/* Greeting */}
      <span className="text-xs text-[var(--gray-11)]">Привет,</span>

      {/* Main row */}
      <div className="mt-1 flex items-center gap-3">
        {/* Avatar with corner badges */}
        <button className="relative shrink-0" style={{ width: avatarSize + 8, height: avatarSize + 8 }}>
          {/* Avatar centered with padding for badges */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={avatarSize} />
          </div>

          {/* Level badge — bottom left, with ring progress */}
          <div className="absolute -bottom-1 -left-1 flex items-center justify-center">
            <svg width={badgeRingSize} height={badgeRingSize} className="-rotate-90">
              <circle
                cx={badgeRingSize / 2} cy={badgeRingSize / 2} r={badgeRadius}
                fill="var(--gray-1)" stroke="var(--gray-5)" strokeWidth={badgeStrokeWidth}
              />
              <circle
                cx={badgeRingSize / 2} cy={badgeRingSize / 2} r={badgeRadius}
                fill="none" stroke="var(--brand-9)" strokeWidth={badgeStrokeWidth}
                strokeLinecap="round"
                strokeDasharray={badgeCircumference}
                strokeDashoffset={badgeStrokeDashoffset}
                className="transition-all duration-500"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-[var(--brand-11)]">
              {user.level}
            </span>
          </div>

          {/* League badge — bottom right */}
          {!isLoading && progress && (
            <Link to="/leaderboard" className="absolute -bottom-1 -right-1">
              {(() => {
                const Icon = LEAGUE_ICONS[progress.tier];
                return <Icon size={28} className="shrink-0" />;
              })()}
            </Link>
          )}
        </button>

        {/* Name only */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold truncate">{user.firstName}</span>
          {/* LP + timer under name */}
          {!isLoading && progress && (
            <Link to="/leaderboard" className="flex items-center gap-1 text-[11px] text-[var(--gray-11)]">
              <span className="font-medium">{stats?.leaguePoints ?? 0} LP</span>
              <span>·</span>
              <HugeiconsIcon icon={Clock01Icon} size={10} />
              <span>{timeLeft || '—'}</span>
            </Link>
          )}
        </div>

        {/* Right indicators */}
        <div className="flex items-center gap-1.5">
          <StreakDaysIndicator count={user.streakDays} />
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант I — C + таймер в блоке лиги
// Лига вертикально: иконка, название, LP, таймер
// Центр: большое кольцо-аватар. Справа: streak/freeze/gems
// ────────────────────────────────────────────
function VariantI() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const ringSize = 72;
  const strokeWidth = 4;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between">
        {/* Left: League vertical — icon, name, LP, timer */}
        {!isLoading && progress ? (
          <Link to="/leaderboard" className="flex flex-col items-center gap-0.5">
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={36} className="shrink-0" />;
            })()}
            <span className="text-[10px] font-semibold">{LEAGUE_NAMES[progress.tier]}</span>
            <span className="text-[10px] text-[var(--gray-11)]">{stats?.leaguePoints ?? 0} LP</span>
            <div className="flex items-center gap-0.5 text-[9px] text-[var(--gray-11)]">
              <HugeiconsIcon icon={Clock01Icon} size={9} />
              <span>{timeLeft || '—'}</span>
            </div>
          </Link>
        ) : (
          <Skeleton className="h-16 w-12 rounded-lg" />
        )}

        {/* Center: Ring Avatar */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 8} />
          </div>
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-2 py-0.5 text-[10px] font-bold text-white leading-none">
            {user.level} ур.
          </div>
        </button>

        {/* Right: Streak + Freeze + Gems vertical */}
        <div className="flex flex-col items-center gap-1.5">
          <StreakDaysIndicator count={user.streakDays} />
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>

      {/* Name */}
      <div className="mt-3 text-center">
        <span className="text-xs text-[var(--gray-11)]">Привет, </span>
        <span className="text-sm font-semibold">{user.firstName}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант J — D без лиги-пилюли + лига вертикально по центру снизу
// Верх: аватар-кольцо | streak | freeze | gems
// Низ: лига вертикально (иконка, название, LP, таймер)
// ────────────────────────────────────────────
function VariantJ() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const ringSize = 44;
  const strokeWidth = 2.5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4">
      {/* Row 1: avatar ring + pills */}
      <div className="flex items-center gap-1.5">
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 4} />
          </div>
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-1.5 text-[9px] font-bold text-white leading-[16px]">
            {user.level}
          </div>
        </button>

        <div className="flex-1" />

        <StreakDaysIndicator count={user.streakDays} />
        <StreakFreezeIndicator count={user.streakFreezes} />
        <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
      </div>

      {/* Row 2: League centered vertical */}
      {!isLoading && progress && (
        <Link to="/leaderboard" className="mt-3 flex flex-col items-center gap-0.5">
          {(() => {
            const Icon = LEAGUE_ICONS[progress.tier];
            return <Icon size={36} className="shrink-0" />;
          })()}
          <span className="text-[10px] font-semibold">{LEAGUE_NAMES[progress.tier]}</span>
          <span className="text-[10px] text-[var(--gray-11)]">{stats?.leaguePoints ?? 0} LP</span>
          <div className="flex items-center gap-0.5 text-[9px] text-[var(--gray-11)]">
            <HugeiconsIcon icon={Clock01Icon} size={9} />
            <span>{timeLeft || '—'}</span>
          </div>
        </Link>
      )}
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант K — Компактная трёхколонка
// Лига (вертикально) | Аватар-кольцо (большое) + имя | Индикаторы
// Без league bar, всё компактно, одна строка
// ────────────────────────────────────────────
function VariantK() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const ringSize = 56;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center gap-3">
        {/* Left: League vertical compact */}
        {!isLoading && progress ? (
          <Link to="/leaderboard" className="flex flex-col items-center gap-0.5 shrink-0">
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={32} className="shrink-0" />;
            })()}
            <span className="text-[10px] font-semibold">{stats?.leaguePoints ?? 0} LP</span>
            <div className="flex items-center gap-0.5 text-[9px] text-[var(--gray-11)]">
              <HugeiconsIcon icon={Clock01Icon} size={9} />
              <span>{timeLeft || '—'}</span>
            </div>
          </Link>
        ) : (
          <Skeleton className="h-12 w-10 rounded-lg" />
        )}

        {/* Center: Ring Avatar + name */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 6} />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {user.level}
          </div>
        </button>

        {/* Name */}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-[var(--gray-11)]">Привет,</span>
          <span className="text-sm font-semibold truncate">{user.firstName}</span>
        </div>

        {/* Right: indicators */}
        <div className="flex items-center gap-1.5">
          <StreakDaysIndicator count={user.streakDays} />
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант L — Duolingo-стиль
// Одна строка: аватар-кольцо слева, справа — ряд из icon+number пар
// равномерно распределённых, без фонов — минимализм
// ────────────────────────────────────────────
function VariantL() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const ringSize = 44;
  const strokeWidth = 2.5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4">
      <div className="flex items-center">
        {/* Avatar with XP ring */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 4} />
          </div>
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-1.5 text-[9px] font-bold text-white leading-[16px]">
            {user.level}
          </div>
        </button>

        {/* Duolingo-style stat icons — evenly spaced */}
        <div className="flex flex-1 items-center justify-evenly ml-2">
          {/* League */}
          {!isLoading && progress && (
            <Link to="/leaderboard" className="flex flex-col items-center gap-0.5">
              {(() => {
                const Icon = LEAGUE_ICONS[progress.tier];
                return <Icon size={28} className="shrink-0" />;
              })()}
              <span className="text-[11px] font-bold text-[var(--gray-12)]">{stats?.leaguePoints ?? 0}</span>
            </Link>
          )}

          {/* Streak */}
          <button className="flex flex-col items-center gap-0.5">
            <span className="text-xl">🔥</span>
            <span className="text-[11px] font-bold text-[var(--orange-11)]">{user.streakDays}</span>
          </button>

          {/* Freeze */}
          {user.streakFreezes > 0 && (
            <button className="flex flex-col items-center gap-0.5">
              <span className="text-xl">❄️</span>
              <span className="text-[11px] font-bold text-[var(--sky-11)]">{user.streakFreezes}</span>
            </button>
          )}

          {/* Gems */}
          <button className="flex flex-col items-center gap-0.5">
            <span className="text-xl">💎</span>
            <span className="text-[11px] font-bold text-[var(--blue-11)]">{user.gems}</span>
          </button>

          {/* Timer */}
          <div className="flex flex-col items-center gap-0.5">
            <HugeiconsIcon icon={Clock01Icon} size={22} className="text-[var(--gray-9)]" />
            <span className="text-[11px] font-bold text-[var(--gray-11)]">{timeLeft || '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант M — Supercell-стиль
// Строка 1: аватар-кольцо + имя + уровень
// Строка 2: цветные ресурс-бары [icon|number] в ряд — каждый свой цвет
// ────────────────────────────────────────────
function VariantM() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const ringSize = 40;
  const strokeWidth = 2.5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4 space-y-2.5">
      {/* Row 1: Identity */}
      <div className="flex items-center gap-3">
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 4} />
          </div>
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold truncate">{user.firstName}</span>
          <span className="text-[11px] text-[var(--gray-11)]">Ур. {user.level}</span>
        </div>
      </div>

      {/* Row 2: Colored resource bars */}
      <div className="flex items-center gap-1.5">
        {/* League pill */}
        {!isLoading && progress && (
          <Link
            to="/leaderboard"
            className="flex h-8 items-center gap-1 rounded-lg bg-[var(--amber-3)] pl-1 pr-2"
          >
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={22} className="shrink-0" />;
            })()}
            <span className="text-[11px] font-bold text-[var(--amber-11)]">{stats?.leaguePoints ?? 0}</span>
            <div className="h-3 w-px bg-[var(--amber-6)]" />
            <div className="flex items-center gap-0.5 text-[10px] text-[var(--amber-11)]">
              <HugeiconsIcon icon={Clock01Icon} size={9} />
              <span>{timeLeft || '—'}</span>
            </div>
          </Link>
        )}

        {/* Streak pill */}
        <StreakDaysIndicator count={user.streakDays} />

        {/* Freeze pill */}
        <StreakFreezeIndicator count={user.streakFreezes} />

        {/* Gems pill */}
        <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант N — Двухуровневый баланс
// Верх: аватар-кольцо + приветствие/имя (слева), кнопка уведомлений (справа)
// Низ: лига-пилюля (D-стиль: icon + LP | timer) + streak бейдж (слева) | freeze + gems (справа)
// ────────────────────────────────────────────
function VariantN() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const ringSize = 48;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4 space-y-3">
      {/* Row 1: Avatar + name | notification button */}
      <div className="flex items-center gap-3">
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 4} />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
            {user.level}
          </div>
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-[var(--gray-11)]">Привет,</span>
          <span className="text-sm font-semibold truncate">{user.firstName}</span>
        </div>
        {/* Notification bell button — 48px to match avatar+ring */}
        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gray-3)]">
          <HugeiconsIcon icon={Notification03Icon} size={22} className="text-[var(--gray-11)]" />
        </button>
      </div>

      {/* Row 2: league pill + streak (left) | freeze + gems (right) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* League pill — D-style: icon + LP | timer */}
          {!isLoading && progress ? (
            <Link
              to="/leaderboard"
              className="flex h-8 items-center gap-1 rounded-full bg-[var(--gray-3)] pl-1 pr-2.5"
            >
              {(() => {
                const Icon = LEAGUE_ICONS[progress.tier];
                return <Icon size={24} className="shrink-0" />;
              })()}
              <span className="text-xs font-semibold">{stats?.leaguePoints ?? 0}</span>
              <div className="h-3 w-px bg-[var(--gray-6)]" />
              <div className="flex items-center gap-0.5 text-[10px] text-[var(--gray-11)]">
                <HugeiconsIcon icon={Clock01Icon} size={10} />
                <span>{timeLeft || '—'}</span>
              </div>
            </Link>
          ) : (
            <Skeleton className="h-8 w-24 rounded-full" />
          )}
          {/* Streak badge */}
          <StreakDaysIndicator count={user.streakDays} />
        </div>

        <div className="flex items-center gap-1.5">
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант N2 — Как N, но аватар чистый (без кольца),
// уровень вынесен как бейдж-кнопка с кольцом прогресса в нижнюю строку перед streak
// ────────────────────────────────────────────
function VariantN2() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  // Level ring params (small, for the badge)
  const lvlRingSize = 32;
  const lvlStroke = 2.5;
  const lvlRadius = (lvlRingSize - lvlStroke) / 2;
  const lvlCircumference = 2 * Math.PI * lvlRadius;
  const lvlDashoffset = lvlCircumference - (progressPercent / 100) * lvlCircumference;

  return (
    <div className="px-4 pt-4 space-y-3">
      {/* Row 1: Plain avatar 48px + name | notification button */}
      <div className="flex items-center gap-3">
        <button className="shrink-0">
          <Avatar src={user.avatarUrl} fallback={user.firstName} size={48} />
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-[var(--gray-11)]">Привет,</span>
          <span className="text-sm font-semibold truncate">{user.firstName}</span>
        </div>
        <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--gray-3)]">
          <HugeiconsIcon icon={Notification03Icon} size={22} className="text-[var(--gray-11)]" />
        </button>
      </div>

      {/* Row 2: league pill | level badge with ring | streak | freeze | gems */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {/* League pill — D-style */}
          {!isLoading && progress ? (
            <Link
              to="/leaderboard"
              className="flex h-8 items-center gap-1 rounded-full bg-[var(--gray-3)] pl-1 pr-2.5"
            >
              {(() => {
                const Icon = LEAGUE_ICONS[progress.tier];
                return <Icon size={24} className="shrink-0" />;
              })()}
              <span className="text-xs font-semibold">{stats?.leaguePoints ?? 0}</span>
              <div className="h-3 w-px bg-[var(--gray-6)]" />
              <div className="flex items-center gap-0.5 text-[10px] text-[var(--gray-11)]">
                <HugeiconsIcon icon={Clock01Icon} size={10} />
                <span>{timeLeft || '—'}</span>
              </div>
            </Link>
          ) : (
            <Skeleton className="h-8 w-24 rounded-full" />
          )}

          {/* Level badge with progress ring border */}
          <button className="relative flex items-center justify-center shrink-0" style={{ width: lvlRingSize, height: lvlRingSize }}>
            <svg width={lvlRingSize} height={lvlRingSize} className="absolute inset-0 -rotate-90">
              <circle
                cx={lvlRingSize / 2} cy={lvlRingSize / 2} r={lvlRadius}
                fill="var(--gray-3)" stroke="var(--gray-5)" strokeWidth={lvlStroke}
              />
              <circle
                cx={lvlRingSize / 2} cy={lvlRingSize / 2} r={lvlRadius}
                fill="none" stroke="var(--brand-9)" strokeWidth={lvlStroke}
                strokeLinecap="round"
                strokeDasharray={lvlCircumference}
                strokeDashoffset={lvlDashoffset}
                className="transition-all duration-500"
              />
            </svg>
            <span className="relative text-xs font-bold text-[var(--gray-12)]">{user.level}</span>
          </button>

          <StreakDaysIndicator count={user.streakDays} />
        </div>

        <div className="flex items-center gap-1.5">
          <StreakFreezeIndicator count={user.streakFreezes} />
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант O — Dashboard micro-cards
// Верх: аватар-кольцо + приветствие/имя
// Низ: сетка 2×2 из мини-карточек (лига, streak, freeze, gems)
// ────────────────────────────────────────────
function VariantO() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const ringSize = 48;
  const strokeWidth = 3;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-4 space-y-3">
      {/* Row 1: Avatar + name + level */}
      <div className="flex items-center gap-3">
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 4} />
          </div>
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--brand-9)] px-1.5 text-[9px] font-bold text-white leading-[16px]">
            {user.level}
          </div>
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-[var(--gray-11)]">Привет,</span>
          <span className="text-sm font-semibold truncate">{user.firstName}</span>
        </div>
      </div>

      {/* Row 2: 2x2 micro-card grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {/* League card */}
        {!isLoading && progress ? (
          <Link
            to="/leaderboard"
            className="flex flex-col items-center gap-1 rounded-xl bg-[var(--gray-3)] py-2"
          >
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={24} className="shrink-0" />;
            })()}
            <span className="text-[11px] font-bold">{stats?.leaguePoints ?? 0}</span>
            <div className="flex items-center gap-0.5 text-[8px] text-[var(--gray-11)]">
              <HugeiconsIcon icon={Clock01Icon} size={7} />
              <span>{timeLeft || '—'}</span>
            </div>
          </Link>
        ) : (
          <Skeleton className="h-16 rounded-xl" />
        )}

        {/* Streak card */}
        <button className="flex flex-col items-center gap-1 rounded-xl bg-[var(--orange-3)] py-2">
          <span className="text-lg">🔥</span>
          <span className="text-[11px] font-bold text-[var(--orange-11)]">{user.streakDays}</span>
          <span className="text-[8px] text-[var(--orange-9)]">дней</span>
        </button>

        {/* Freeze card */}
        <button className="flex flex-col items-center gap-1 rounded-xl bg-[var(--sky-3)] py-2">
          <span className="text-lg">❄️</span>
          <span className="text-[11px] font-bold text-[var(--sky-11)]">{user.streakFreezes}</span>
          <span className="text-[8px] text-[var(--sky-9)]">фризов</span>
        </button>

        {/* Gems card */}
        <button className="flex flex-col items-center gap-1 rounded-xl bg-[var(--blue-3)] py-2">
          <span className="text-lg">💎</span>
          <span className="text-[11px] font-bold text-[var(--blue-11)]">{user.gems}</span>
          <span className="text-[8px] text-[var(--blue-9)]">гемов</span>
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Вариант P — TMA Ultra-compact
// Единая строка 40px: аватар-кольцо | лига-иконка | LP | ⏱время | streak | freeze | gems
// Максимально компактный, без текстовых лейблов
// ────────────────────────────────────────────
function VariantP() {
  const user = useUserStore((s) => s.user);
  const { progress, stats, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => setTimeLeft(formatTimeLeft(endDate));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  if (!user) return null;

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  const ringSize = 36;
  const strokeWidth = 2;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

  return (
    <div className="px-4 pt-3">
      <div className="flex h-10 items-center gap-2">
        {/* Tiny avatar with ring */}
        <button className="relative shrink-0">
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--gray-4)" strokeWidth={strokeWidth}
            />
            <circle
              cx={ringSize / 2} cy={ringSize / 2} r={radius}
              fill="none" stroke="var(--brand-9)" strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Avatar src={user.avatarUrl} fallback={user.firstName} size={ringSize - strokeWidth * 2 - 4} />
          </div>
        </button>

        {/* Level number */}
        <span className="text-sm font-bold text-[var(--brand-11)]">{user.level}</span>

        <div className="h-4 w-px bg-[var(--gray-5)]" />

        {/* League icon + LP */}
        {!isLoading && progress && (
          <Link to="/leaderboard" className="flex items-center gap-1">
            {(() => {
              const Icon = LEAGUE_ICONS[progress.tier];
              return <Icon size={22} className="shrink-0" />;
            })()}
            <span className="text-xs font-bold">{stats?.leaguePoints ?? 0}</span>
          </Link>
        )}

        <div className="h-4 w-px bg-[var(--gray-5)]" />

        {/* Timer */}
        <div className="flex items-center gap-0.5 text-[11px] text-[var(--gray-11)]">
          <HugeiconsIcon icon={Clock01Icon} size={12} />
          <span>{timeLeft || '—'}</span>
        </div>

        <div className="flex-1" />

        {/* Right: pills */}
        <StreakDaysIndicator count={user.streakDays} />
        <StreakFreezeIndicator count={user.streakFreezes} />
        <GemsIndicator gems={user.gems} freezes={user.streakFreezes} />
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Shared: League progress bar
// ────────────────────────────────────────────
type LeagueBarProps = {
  isProtected: boolean;
  leagueZone: ReturnType<typeof getLeagueZoneInfo> | null;
};

function LeagueBar({ isProtected, leagueZone }: LeagueBarProps) {
  return (
    <div className="relative h-2 w-full">
      <div className="absolute inset-0 flex overflow-hidden rounded-full">
        {!isProtected ? (
          <>
            <div className="h-full w-1/3" style={{ backgroundColor: leagueZone?.zone === 'demotion' ? 'var(--red-9)' : 'var(--red-6)' }} />
            <div className="h-full w-1/3" style={{ backgroundColor: leagueZone?.zone === 'safe' ? 'var(--gray-9)' : 'var(--gray-6)' }} />
            <div className="h-full w-[11.1%]" style={{ backgroundColor: leagueZone?.zone === 'promotion_x1' ? 'var(--green-9)' : 'var(--green-6)' }} />
            <div className="h-full w-[11.1%]" style={{ backgroundColor: leagueZone?.zone === 'promotion_x2' ? 'var(--blue-9)' : 'var(--blue-6)' }} />
            <div className="h-full w-[11.1%]" style={{ backgroundColor: leagueZone?.zone === 'promotion_x3' ? 'var(--violet-9)' : 'var(--violet-6)' }} />
          </>
        ) : (
          <>
            <div className="h-full w-1/2" style={{ backgroundColor: leagueZone?.zone === 'safe' ? 'var(--gray-9)' : 'var(--gray-6)' }} />
            <div className="h-full w-[16.6%]" style={{ backgroundColor: leagueZone?.zone === 'promotion_x1' ? 'var(--green-9)' : 'var(--green-6)' }} />
            <div className="h-full w-[16.6%]" style={{ backgroundColor: leagueZone?.zone === 'promotion_x2' ? 'var(--blue-9)' : 'var(--blue-6)' }} />
            <div className="h-full w-[16.7%]" style={{ backgroundColor: leagueZone?.zone === 'promotion_x3' ? 'var(--violet-9)' : 'var(--violet-6)' }} />
          </>
        )}
      </div>
      {leagueZone && (
        <div
          className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-white shadow"
          style={{ left: `clamp(2px, ${leagueZone.positionPercent}%, calc(100% - 2px))` }}
        />
      )}
    </div>
  );
}


// ────────────────────────────────────────────
// Тестовая страница
// ────────────────────────────────────────────
const VARIANTS = [
  { key: 'current', label: 'Текущий' },
  { key: 'a', label: 'A Кольцо' },
  { key: 'b', label: 'B Inline' },
  { key: 'c', label: 'C Центр' },
  { key: 'd', label: 'D Пилюли' },
  { key: 'e', label: 'E Кольцо-мини' },
  { key: 'f', label: 'F Плоский' },
  { key: 'g', label: 'G Кольцо v2' },
  { key: 'h', label: 'H Бейджи' },
  { key: 'i', label: 'I Лига+время' },
  { key: 'j', label: 'J D+лига центр' },
  { key: 'k', label: 'K 3-колонки' },
  { key: 'l', label: 'L Duolingo' },
  { key: 'm', label: 'M Supercell' },
  { key: 'n', label: 'N Двухуровн.' },
  { key: 'n2', label: 'N2 Чистый' },
  { key: 'o', label: 'O Dashboard' },
  { key: 'p', label: 'P Ultra' },
] as const;

type VariantKey = (typeof VARIANTS)[number]['key'];

const VARIANT_DESCRIPTIONS: Record<VariantKey, string> = {
  current: 'Card с двумя колонками + league progress bar',
  a: 'Кольцо XP вокруг аватара + league bar строкой',
  b: 'Пилюли + XP bar полная ширина + league bar inline',
  c: 'Большой аватар-кольцо по центру, лига и streak по бокам',
  d: 'Без league bar. Кольцо аватар + лига-пилюля (LP + таймер)',
  e: 'Без league bar. Кольцо + имя слева, лига-пилюля (LP/таймер) справа',
  f: 'Без league bar. Одна строка пилюль: аватар | уровень+мини-бар | лига | streak | gems',
  g: 'Кольцо v2: приветствие сверху, уровень инлайн с именем, лига = размер аватара',
  h: 'Бейджи в углах аватара: уровень (с мини-кольцом) внизу-лево, лига внизу-право',
  i: 'Как C, но лига с таймером: иконка + название + LP + время. Без league bar',
  j: 'D без лиги-пилюли. Верх: аватар-кольцо + pills. Низ: лига вертикально по центру',
  k: '3 колонки: лига (верт.) | аватар-кольцо + имя | индикаторы. Компактно',
  l: 'Duolingo-стиль: аватар-кольцо слева, справа — иконка+число пары равномерно',
  m: 'Supercell-стиль: identity строка + цветные ресурс-пилюли. Каждый элемент свой цвет',
  n: 'Двухуровневый: аватар-кольцо+имя + уведомления сверху. Лига-пилюля (D) + streak слева, freeze + gems справа',
  n2: 'Как N, но аватар чистый 48px. Уровень — бейдж-кнопка с кольцом прогресса в нижней строке перед streak',
  o: 'Dashboard: аватар+имя сверху, 4 мини-карточки (лига, streak, freeze, gems) в сетке',
  p: 'TMA Ultra-compact: единая строка 40px, все элементы минимальны, без лейблов',
};

export function TestHeader() {
  const [active, setActive] = useState<VariantKey>('current');

  return (
    <div className="flex min-h-full flex-col">
      {/* Render active variant */}
      <div className="border-b border-[var(--gray-6)] pb-4">
        {active === 'current' && <CurrentHeader />}
        {active === 'a' && <VariantA />}
        {active === 'b' && <VariantB />}
        {active === 'c' && <VariantC />}
        {active === 'd' && <VariantD />}
        {active === 'e' && <VariantE />}
        {active === 'f' && <VariantF />}
        {active === 'g' && <VariantG />}
        {active === 'h' && <VariantH />}
        {active === 'i' && <VariantI />}
        {active === 'j' && <VariantJ />}
        {active === 'k' && <VariantK />}
        {active === 'l' && <VariantL />}
        {active === 'm' && <VariantM />}
        {active === 'n' && <VariantN />}
        {active === 'n2' && <VariantN2 />}
        {active === 'o' && <VariantO />}
        {active === 'p' && <VariantP />}
      </div>

      {/* Description */}
      <div className="border-b border-[var(--gray-6)] px-4 py-2">
        <p className="text-xs text-[var(--gray-11)]">{VARIANT_DESCRIPTIONS[active]}</p>
      </div>

      {/* Quiz placeholder */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="rounded-xl bg-[var(--gray-3)] px-6 py-4 text-center">
          <p className="text-lg font-semibold text-[var(--gray-11)]">Тут будет квиз</p>
          <p className="mt-1 text-sm text-[var(--gray-9)]">Заглушка для тестирования шапки</p>
        </div>
      </div>

      {/* Variant switcher */}
      <div className="sticky bottom-0 border-t border-[var(--gray-6)] bg-[var(--gray-1)] p-3">
        <div className="flex flex-wrap gap-1.5">
          {VARIANTS.map((v) => (
            <button
              key={v.key}
              onClick={() => setActive(v.key)}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors',
                active === v.key
                  ? 'bg-[var(--brand-9)] text-white'
                  : 'bg-[var(--gray-3)] text-[var(--gray-11)]'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
