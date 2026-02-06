import Lottie from 'lottie-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import snowflakeData from '@/assets/snowflake-freeze.json';

type StreakFreezeIndicatorProps = {
  count: number;
  size?: 'sm' | 'lg';
  onClick?: () => void;
};

export function StreakFreezeIndicator({ count, size = 'sm', onClick }: StreakFreezeIndicatorProps) {
  const lg = size === 'lg';
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-0.5 rounded-full bg-[var(--sky-3)] active:bg-[var(--sky-4)] ${lg ? 'h-12 pl-2 pr-3' : 'h-8 pl-1 pr-2'}`}
    >
      <Lottie
        animationData={snowflakeData}
        loop
        autoplay
        className={lg ? 'h-8 w-8 shrink-0' : 'h-6 w-6 shrink-0'}
      />
      <span className={`font-semibold text-[var(--sky-11)] ${lg ? 'text-sm' : 'text-xs'}`}>{count}</span>
      <HugeiconsIcon icon={Add01Icon} size={lg ? 18 : 16} className="text-[var(--sky-8)]" strokeWidth={2} />
    </button>
  );
}
