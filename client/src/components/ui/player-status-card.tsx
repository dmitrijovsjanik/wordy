import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeagueStore } from '@/stores/league-store';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon } from '@hugeicons/core-free-icons';
import Lottie from 'lottie-react';
import fireStreakData from '@/assets/fire-streak.json';
import { cn } from '@/lib/utils';
import { LP_THRESHOLDS, PROTECTED_TIERS } from '@/lib/league-config';
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

type LeagueZone = 'promotion_x3' | 'promotion_x2' | 'promotion_x1' | 'safe' | 'demotion';

function getLeagueZoneInfo(position: number, total: number, leaguePoints: number, isProtected: boolean) {
  // Реальные пороги по позиции: топ-20% повышение, низ-20% понижение
  const promotionThreshold = Math.max(1, Math.ceil(total * 0.2));
  const demotionThreshold = Math.floor(total * 0.8);

  let zone: LeagueZone = 'safe';
  let result = 0;

  // Определяем зону и результат
  if (position <= promotionThreshold) {
    if (leaguePoints >= LP_THRESHOLDS.PROMOTION_3.min) {
      zone = 'promotion_x3';
      result = 3;
    } else if (leaguePoints >= LP_THRESHOLDS.PROMOTION_2.min) {
      zone = 'promotion_x2';
      result = 2;
    } else if (leaguePoints >= LP_THRESHOLDS.PROMOTION_1.min) {
      zone = 'promotion_x1';
      result = 1;
    } else {
      zone = 'promotion_x1';
      result = 1;
    }
  } else if (!isProtected && position > demotionThreshold) {
    zone = 'demotion';
    result = -1;
  }

  // Рассчитываем позицию маркера для равномерных секторов на баре
  // Бар: [понижение 1/3 | безопасно 1/3 | повышение 1/3] или [безопасно 1/2 | повышение 1/2]
  let positionPercent: number;

  if (isProtected) {
    // Без понижения: [безопасно 0-50% | повышение 50-100%]
    if (position <= promotionThreshold) {
      // В зоне повышения: маппим 1..promotionThreshold → 100%..50%
      const progressInZone = (promotionThreshold - position) / Math.max(1, promotionThreshold - 1);
      positionPercent = 50 + progressInZone * 50;
    } else {
      // Безопасная зона: маппим promotionThreshold+1..total → 50%..0%
      const safeZoneSize = total - promotionThreshold;
      const posInSafe = position - promotionThreshold;
      positionPercent = 50 - (posInSafe / safeZoneSize) * 50;
    }
  } else {
    // С понижением: [понижение 0-33% | безопасно 33-66% | повышение 66-100%]
    if (position <= promotionThreshold) {
      // Повышение: маппим 1..promotionThreshold → 100%..66.6%
      const progressInZone = (promotionThreshold - position) / Math.max(1, promotionThreshold - 1);
      positionPercent = 66.6 + progressInZone * 33.3;
    } else if (position > demotionThreshold) {
      // Понижение: маппим demotionThreshold+1..total → 33.3%..0%
      const demotionZoneSize = total - demotionThreshold;
      const posInDemotion = position - demotionThreshold;
      positionPercent = 33.3 - (posInDemotion / demotionZoneSize) * 33.3;
    } else {
      // Безопасная зона: маппим promotionThreshold+1..demotionThreshold → 66.6%..33.3%
      const safeZoneSize = demotionThreshold - promotionThreshold;
      const posInSafe = position - promotionThreshold;
      positionPercent = 66.6 - (posInSafe / safeZoneSize) * 33.3;
    }
  }

  return { positionPercent, zone, result };
}


type PlayerStatusCardProps = {
  user: {
    level: number;
    xp: number;
    streakDays: number;
  };
  className?: string;
};

export function PlayerStatusCard({ user, className }: PlayerStatusCardProps) {
  const { progress, stats, position, season, isLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Обновляем таймер каждую минуту
  useEffect(() => {
    if (!season?.startedAt) return;

    // Сезон длится 7 дней
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);

    const updateTimer = () => setTimeLeft(formatTimeLeft(endDate));
    updateTimer();

    const interval = setInterval(updateTimer, 60 * 1000);
    return () => clearInterval(interval);
  }, [season?.startedAt]);

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  if (isLoading || !progress) {
    return <Skeleton className={cn('h-24 w-full rounded-2xl', className)} />;
  }

  const isProtected = PROTECTED_TIERS.includes(progress.tier);
  const leagueZone = position && position.total > 0
    ? getLeagueZoneInfo(position.position, position.total, stats?.leaguePoints ?? 0, isProtected)
    : null;

  return (
    <Card className={cn('p-4', className)}>
      <div className="flex items-stretch gap-4">
        {/* Левая часть — уровень и XP */}
        <div className="flex flex-1 flex-col justify-between">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-[var(--accent-11)]">{user.level}</span>
            <span className="text-sm text-[var(--gray-11)]">ур.</span>
            {user.streakDays > 0 && (
              <div className="ml-auto flex items-center gap-0.5 text-sm text-[var(--gray-11)]">
                <Lottie animationData={fireStreakData} loop autoplay className="relative -top-[2px] h-5 w-5 shrink-0" />
                <span>{user.streakDays}</span>
              </div>
            )}
          </div>
          <div className="mt-2">
            <Progress value={progressPercent} className="h-2" />
            <span className="mt-1 block text-xs text-[var(--gray-11)]">
              {user.xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP
            </span>
          </div>
        </div>

        {/* Разделитель */}
        <div className="w-px bg-[var(--gray-6)]" />

        {/* Правая часть — лига */}
        <Link to="/leaderboard" className="flex flex-1 flex-col justify-between">
          {/* Верх: бейдж лиги + результат */}
          <div className="flex items-center gap-1">
            {(() => {
              const IconComponent = LEAGUE_ICONS[progress.tier];
              return <IconComponent size={32} className="shrink-0" />;
            })()}
            <span className="text-sm font-semibold">{LEAGUE_NAMES[progress.tier]}</span>
            <span className="text-sm text-[var(--gray-11)]">{DIVISION_LABELS[progress.division - 1]}</span>
            {leagueZone ? (
              <span
                className={cn(
                  'ml-auto text-sm font-medium',
                  leagueZone.zone === 'promotion_x3' && 'text-[var(--violet-11)]',
                  leagueZone.zone === 'promotion_x2' && 'text-[var(--blue-11)]',
                  leagueZone.zone === 'promotion_x1' && 'text-[var(--green-11)]',
                  leagueZone.zone === 'demotion' && 'text-[var(--red-11)]',
                  leagueZone.zone === 'safe' && 'text-[var(--gray-11)]',
                )}
              >
                {leagueZone.result > 0 && '+'}
                {leagueZone.result !== 0 ? leagueZone.result : '±0'}
              </span>
            ) : (
              <span className="ml-auto text-sm text-[var(--gray-11)]">—</span>
            )}
          </div>

          {/* Середина: прогресс-бар с зонами */}
          <div className="mt-2">
            <div className="relative h-2 w-full">
              {/*
                Зоны равномерно делят бар:
                - С понижением: 33.3% понижение | 33.3% безопасно | 33.3% повышение (по 11.1% на x1/x2/x3)
                - Без понижения: 50% безопасно | 50% повышение (по 16.6% на x1/x2/x3)
                Фон: step-3, текущая зона: step-9
              */}
              <div className="absolute inset-0 flex overflow-hidden rounded-full">
                {!isProtected ? (
                  <>
                    {/* Понижение — 1/3 */}
                    <div
                      className="h-full w-1/3"
                      style={{ backgroundColor: leagueZone?.zone === 'demotion' ? 'var(--red-9)' : 'var(--red-6)' }}
                    />
                    {/* Безопасно — 1/3 */}
                    <div
                      className="h-full w-1/3"
                      style={{ backgroundColor: leagueZone?.zone === 'safe' ? 'var(--gray-9)' : 'var(--gray-6)' }}
                    />
                    {/* Повышение — 1/3 разбито на 3 равные части */}
                    <div
                      className="h-full w-[11.1%]"
                      style={{ backgroundColor: leagueZone?.zone === 'promotion_x1' ? 'var(--green-9)' : 'var(--green-6)' }}
                    />
                    <div
                      className="h-full w-[11.1%]"
                      style={{ backgroundColor: leagueZone?.zone === 'promotion_x2' ? 'var(--blue-9)' : 'var(--blue-6)' }}
                    />
                    <div
                      className="h-full w-[11.1%]"
                      style={{ backgroundColor: leagueZone?.zone === 'promotion_x3' ? 'var(--violet-9)' : 'var(--violet-6)' }}
                    />
                  </>
                ) : (
                  <>
                    {/* Безопасно — 1/2 */}
                    <div
                      className="h-full w-1/2"
                      style={{ backgroundColor: leagueZone?.zone === 'safe' ? 'var(--gray-9)' : 'var(--gray-6)' }}
                    />
                    {/* Повышение — 1/2 разбито на 3 равные части */}
                    <div
                      className="h-full w-[16.6%]"
                      style={{ backgroundColor: leagueZone?.zone === 'promotion_x1' ? 'var(--green-9)' : 'var(--green-6)' }}
                    />
                    <div
                      className="h-full w-[16.6%]"
                      style={{ backgroundColor: leagueZone?.zone === 'promotion_x2' ? 'var(--blue-9)' : 'var(--blue-6)' }}
                    />
                    <div
                      className="h-full w-[16.7%]"
                      style={{ backgroundColor: leagueZone?.zone === 'promotion_x3' ? 'var(--violet-9)' : 'var(--violet-6)' }}
                    />
                  </>
                )}
              </div>
              {/* Маркер позиции игрока */}
              {leagueZone && (
                <div
                  className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-white shadow"
                  style={{ left: `clamp(2px, ${leagueZone.positionPercent}%, calc(100% - 2px))` }}
                />
              )}
            </div>
            {/* Низ: LP слева, таймер справа */}
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-xs text-[var(--gray-11)]">
                {stats ? stats.leaguePoints : 0} LP
              </span>
              <div className="flex items-center gap-0.5 text-xs text-[var(--gray-11)]">
                <HugeiconsIcon icon={Clock01Icon} size={12} />
                <span>{timeLeft || '—'}</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </Card>
  );
}
