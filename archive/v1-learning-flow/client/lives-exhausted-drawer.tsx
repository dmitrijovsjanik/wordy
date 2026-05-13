import { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { FavouriteIcon, Crown02Icon } from '@hugeicons/core-free-icons';
import Lottie from 'lottie-react';
import gemSpinData from '@/assets/gem-spin.json';
import { createPayment } from '@/lib/api';

type LivesExhaustedDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  livesRestoredAt: string | null;
  gems: number;
  refillCost: number;
  onRefill: () => void;
  onTimerExpired: () => void;
};

const LIVES_RUB_PRICE = 49;

function formatTimeLeft(ms: number): string {
  if (ms <= 0) return '0м';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}ч ${minutes}м`;
  return `${minutes}м`;
}

export function LivesExhaustedDrawer({
  open,
  onOpenChange,
  livesRestoredAt,
  gems,
  refillCost,
  onRefill,
  onTimerExpired,
}: LivesExhaustedDrawerProps) {
  const [timeLeft, setTimeLeft] = useState('');
  const [isPurchasing, setIsPurchasing] = useState(false);

  useEffect(() => {
    if (!open) return;
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
  }, [open, livesRestoredAt, onTimerExpired]);

  const canAfford = gems >= refillCost;

  const handleRublePurchase = useCallback(async () => {
    setIsPurchasing(true);
    try {
      const { confirmationUrl } = await createPayment('lives_refill');
      window.open(confirmationUrl, '_blank');
      onOpenChange(false);
    } catch {
      // ignore
    } finally {
      setIsPurchasing(false);
    }
  }, [onOpenChange]);

  const handlePremium = useCallback(async () => {
    setIsPurchasing(true);
    try {
      const { confirmationUrl } = await createPayment('premium_month');
      window.open(confirmationUrl, '_blank');
      onOpenChange(false);
    } catch {
      // ignore
    } finally {
      setIsPurchasing(false);
    }
  }, [onOpenChange]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          {/* Grey hearts */}
          <div className="mb-2 flex justify-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <HugeiconsIcon
                key={i}
                icon={FavouriteIcon}
                size={24}
                className="text-[var(--gray-6)]"
                strokeWidth={2}
              />
            ))}
          </div>
          <DrawerTitle className="text-center text-lg">
            Жизни закончились
          </DrawerTitle>
          <DrawerDescription className="text-center">
            {timeLeft
              ? <>Восстановление через <span className="font-semibold text-[var(--gray-12)]">{timeLeft}</span></>
              : 'Подождите или восстановите жизни'}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerFooter>
          {/* Adaptive CTA: gems if enough, rubles if not */}
          {canAfford ? (
            <Button
              onClick={onRefill}
              className="w-full gap-2"
            >
              <span>Восстановить за</span>
              <Lottie animationData={gemSpinData} loop autoplay className="h-5 w-5 shrink-0" />
              <span>{refillCost}</span>
            </Button>
          ) : (
            <>
              <Button
                onClick={handleRublePurchase}
                disabled={isPurchasing}
                className="w-full gap-2"
              >
                <span>Восстановить за {LIVES_RUB_PRICE} ₽</span>
              </Button>
              <p className="text-center text-xs text-[var(--gray-11)]">
                Не хватает кристаллов: {gems}/{refillCost}
              </p>
            </>
          )}

          {/* Premium */}
          <Button
            variant="secondary"
            onClick={handlePremium}
            disabled={isPurchasing}
            className="w-full gap-2"
          >
            <HugeiconsIcon icon={Crown02Icon} size={18} className="text-[var(--amber-11)]" strokeWidth={2} />
            <span>Premium — бесконечные жизни</span>
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
