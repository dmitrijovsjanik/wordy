import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { FavouriteIcon } from '@hugeicons/core-free-icons';
import Lottie from 'lottie-react';
import gemSpinData from '@/assets/gem-spin.json';

type LivesExhaustedOverlayProps = {
  livesRestoredAt: string | null;
  gems: number;
  refillCost: number;
  onRefill: () => void;
  onTimerExpired: () => void;
};

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return '0м';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}

export function LivesExhaustedOverlay({
  livesRestoredAt,
  gems,
  refillCost,
  onRefill,
  onTimerExpired,
}: LivesExhaustedOverlayProps) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (!livesRestoredAt) {
      onTimerExpired();
      return;
    }

    const endTime = new Date(livesRestoredAt).getTime();

    const update = () => {
      const remaining = endTime - Date.now();
      if (remaining <= 0) {
        onTimerExpired();
        return;
      }
      setTimeLeft(formatTimeLeft(remaining));
    };

    update();
    const interval = setInterval(update, 10_000);
    return () => clearInterval(interval);
  }, [livesRestoredAt, onTimerExpired]);

  const canAfford = gems >= refillCost;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--gray-1)]/95 px-8">
      {/* Broken hearts */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <HugeiconsIcon
            key={i}
            icon={FavouriteIcon}
            size={32}
            className="text-[var(--gray-6)]"
            strokeWidth={2}
          />
        ))}
      </div>

      <h2 className="mb-2 text-xl font-bold text-[var(--gray-12)]">
        Жизни закончились
      </h2>

      {timeLeft && (
        <p className="mb-6 text-sm text-[var(--gray-11)]">
          Восстановление через <span className="font-semibold">{timeLeft}</span>
        </p>
      )}

      <Button
        onClick={onRefill}
        disabled={!canAfford}
        className="w-full max-w-xs gap-2"
      >
        <span>Восстановить за</span>
        <Lottie animationData={gemSpinData} loop autoplay className="h-5 w-5 shrink-0" />
        <span>{refillCost}</span>
      </Button>

      {!canAfford && (
        <p className="mt-2 text-xs text-[var(--red-11)]">
          Недостаточно кристаллов
        </p>
      )}
    </div>
  );
}
