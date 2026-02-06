import Lottie from 'lottie-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import gemSpinData from '@/assets/gem-spin.json';
import snowflakeData from '@/assets/snowflake-freeze.json';

type GemsIndicatorProps = {
  gems: number;
  freezes: number;
  onClick?: () => void;
};

export function GemsIndicator({ gems, freezes, onClick }: GemsIndicatorProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-8 items-center gap-1 rounded-full bg-[var(--blue-3)] pl-1 pr-2 active:bg-[var(--blue-4)]"
    >
      <Lottie
        animationData={snowflakeData}
        loop
        autoplay
        className="h-6 w-6 shrink-0"
      />
      <span className="text-xs font-semibold text-[var(--sky-11)]">{freezes}</span>

      <div className="mx-0.5 h-3.5 w-px bg-[var(--blue-6)]" />

      <Lottie
        animationData={gemSpinData}
        loop
        autoplay
        className="h-6 w-6 shrink-0"
      />
      <span className="text-xs font-semibold text-[var(--blue-11)]">{gems}</span>

      <HugeiconsIcon icon={Add01Icon} size={16} className="text-[var(--blue-8)]" strokeWidth={2} />
    </button>
  );
}
