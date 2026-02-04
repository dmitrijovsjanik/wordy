import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { LeagueTier } from '@/types/api';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';

const LEAGUE_TIERS: LeagueTier[] = [
  'bronze',
  'silver',
  'gold',
  'amber',
  'sapphire',
  'amethyst',
  'topaz',
  'ruby',
  'legend',
];

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

type LeagueScrollProps = {
  currentTier: LeagueTier;
  currentDivision: number;
  className?: string;
};

export function LeagueScroll({ currentTier, currentDivision, className }: LeagueScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);
  const currentIndex = LEAGUE_TIERS.indexOf(currentTier);

  const scrollToCurrentItem = useCallback(() => {
    if (currentItemRef.current && scrollRef.current) {
      currentItemRef.current.scrollIntoView({
        behavior: 'instant',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, []);

  useEffect(() => {
    // Используем requestAnimationFrame для гарантии что DOM обновился
    const raf = requestAnimationFrame(() => {
      scrollToCurrentItem();
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollToCurrentItem, currentTier]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex gap-3 overflow-x-auto scrollbar-hide px-4 -mx-4 snap-x snap-mandatory',
        className
      )}
    >
      {LEAGUE_TIERS.map((tier) => {
        const IconComponent = LEAGUE_ICONS[tier];
        const isCurrent = tier === currentTier;
        const isPast = LEAGUE_TIERS.indexOf(tier) < currentIndex;

        return (
          <div
            key={tier}
            ref={isCurrent ? currentItemRef : undefined}
            className={cn(
              'flex flex-col items-center gap-1.5 py-2 px-1 snap-center flex-shrink-0 transition-opacity',
              !isCurrent && !isPast && 'opacity-40'
            )}
          >
            <div
              className={cn(
                'rounded-full p-1 transition-all',
                isCurrent && 'ring-2 ring-[var(--brand-9)] ring-offset-2 ring-offset-[var(--gray-1)]'
              )}
            >
              <IconComponent size={isCurrent ? 48 : 40} />
            </div>
            <span
              className={cn(
                'text-xs font-medium whitespace-nowrap',
                isCurrent ? 'text-[var(--gray-12)]' : 'text-[var(--gray-11)]'
              )}
            >
              {LEAGUE_NAMES[tier]}
            </span>
            {isCurrent && (
              <span className="text-[10px] text-[var(--gray-11)]">
                {DIVISION_LABELS[currentDivision - 1]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
