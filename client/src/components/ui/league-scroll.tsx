import { useRef, useEffect, useCallback, useState } from 'react';
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

type LeagueScrollProps = {
  currentTier: LeagueTier;
  className?: string;
};

export function LeagueScroll({ currentTier, className }: LeagueScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentItemRef = useRef<HTMLDivElement>(null);
  const currentIndex = LEAGUE_TIERS.indexOf(currentTier);
  const [showLeftGradient, setShowLeftGradient] = useState(false);
  const [showRightGradient, setShowRightGradient] = useState(false);

  const updateGradients = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const threshold = 5;
    setShowLeftGradient(el.scrollLeft > threshold);
    setShowRightGradient(el.scrollLeft < el.scrollWidth - el.clientWidth - threshold);
  }, []);

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
    const raf = requestAnimationFrame(() => {
      scrollToCurrentItem();
      updateGradients();
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollToCurrentItem, updateGradients, currentTier]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateGradients, { passive: true });
    return () => el.removeEventListener('scroll', updateGradients);
  }, [updateGradients]);

  return (
    <div className={cn('relative -mx-4', className)}>
      <div
        className={cn(
          'pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-[var(--gray-2)] to-transparent transition-opacity duration-200',
          showLeftGradient ? 'opacity-100' : 'opacity-0'
        )}
      />
      <div
        className={cn(
          'pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-[var(--gray-2)] to-transparent transition-opacity duration-200',
          showRightGradient ? 'opacity-100' : 'opacity-0'
        )}
      />

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide px-4 snap-x snap-mandatory"
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
              <IconComponent size={isCurrent ? 72 : 64} />
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isCurrent ? 'text-[var(--gray-12)]' : 'text-[var(--gray-11)]'
                )}
              >
                {LEAGUE_NAMES[tier]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
