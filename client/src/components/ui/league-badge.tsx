import { cn } from '@/lib/utils';
import type { LeagueTier } from '@/types/api';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';

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

type LeagueBadgeProps = {
  tier: LeagueTier;
  division: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
};

export function LeagueBadge({
  tier,
  division,
  size = 'md',
  showLabel = true,
  className,
}: LeagueBadgeProps) {
  const sizes = { sm: 24, md: 32, lg: 48 };
  const iconSize = sizes[size];
  const IconComponent = LEAGUE_ICONS[tier];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <IconComponent size={iconSize} className="flex-shrink-0" />
      {showLabel && (
        <div className="flex flex-col">
          <span className={cn('font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {LEAGUE_NAMES[tier]}
          </span>
          <span className="text-xs text-[var(--gray-11)]">{DIVISION_LABELS[division - 1]}</span>
        </div>
      )}
    </div>
  );
}

export function getLeagueName(tier: LeagueTier): string {
  return LEAGUE_NAMES[tier];
}

export function getDivisionLabel(division: number): string {
  return DIVISION_LABELS[division - 1] ?? '';
}
