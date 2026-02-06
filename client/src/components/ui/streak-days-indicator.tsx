import Lottie from 'lottie-react';
import fireStreakData from '@/assets/fire-streak.json';

type StreakDaysIndicatorProps = {
  count: number;
  onClick?: () => void;
};

export function StreakDaysIndicator({ count, onClick }: StreakDaysIndicatorProps) {
  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex h-8 items-center gap-0.5 rounded-full bg-[var(--orange-3)] pl-1 pr-3 active:bg-[var(--orange-4)]"
    >
      <Lottie
        animationData={fireStreakData}
        loop
        autoplay
        className="relative -top-[4px] h-6 w-6 shrink-0"
      />
      <span className="text-xs font-semibold text-[var(--orange-11)]">{count}</span>
    </button>
  );
}
