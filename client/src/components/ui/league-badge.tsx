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

type LeagueBadgeProps = {
  tier: LeagueTier;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
};

export function LeagueBadge({
  tier,
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
        <span className={cn('font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {LEAGUE_NAMES[tier]}
        </span>
      )}
    </div>
  );
}

export function getLeagueName(tier: LeagueTier): string {
  return LEAGUE_NAMES[tier];
}
