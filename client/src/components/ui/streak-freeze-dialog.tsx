import { useState } from 'react';
import Lottie from 'lottie-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { purchaseStreakFreeze } from '@/lib/api';
import { useTelegram } from '@/hooks/use-telegram';
import snowflakeData from '@/assets/snowflake-freeze.json';
import gemSpinData from '@/assets/gem-spin.json';

const FREEZE_COST = 200;

type StreakFreezeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentFreezes: number;
  currentGems: number;
  onPurchaseSuccess: () => void;
};

export function StreakFreezeDialog({
  open,
  onOpenChange,
  currentFreezes,
  currentGems,
  onPurchaseSuccess,
}: StreakFreezeDialogProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hapticNotification } = useTelegram();

  const canAfford = currentGems >= FREEZE_COST;

  const handlePurchase = async () => {
    if (!canAfford) return;
    setIsPurchasing(true);
    setError(null);

    try {
      await purchaseStreakFreeze();
      hapticNotification('success');
      onPurchaseSuccess();
      onOpenChange(false);
    } catch (err) {
      hapticNotification('error');
      const message = err instanceof Error ? err.message : 'Ошибка при покупке';
      setError(message);
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <div className="flex justify-center">
            <Lottie
              animationData={snowflakeData}
              loop
              autoplay
              className="h-20 w-20"
            />
          </div>
          <DrawerTitle className="text-center">Заморозка стрика</DrawerTitle>
          <DrawerDescription className="text-center">
            Защита на 1 пропущенный день. У вас: {currentFreezes} в запасе.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col items-center gap-3 px-4">
          {/* Цена */}
          <div className="flex items-center gap-2 rounded-xl bg-[var(--gray-3)] px-4 py-3">
            <span className="text-sm text-[var(--gray-11)]">Цена:</span>
            <div className="flex items-center gap-1">
              <Lottie
                animationData={gemSpinData}
                loop
                autoplay
                className="h-6 w-6 shrink-0"
              />
              <span className="text-lg font-bold text-[var(--blue-11)]">{FREEZE_COST}</span>
            </div>
          </div>

          {/* Баланс */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-[var(--gray-11)]">У вас:</span>
            <Lottie
              animationData={gemSpinData}
              loop
              autoplay
              className="h-5 w-5 shrink-0"
            />
            <span className={`font-semibold ${canAfford ? 'text-[var(--blue-11)]' : 'text-[var(--red-11)]'}`}>
              {currentGems}
            </span>
          </div>

          {/* Статус */}
          {!canAfford && (
            <p className="text-sm text-[var(--red-11)]">
              Недостаточно кристаллов
            </p>
          )}
          {error && (
            <p className="text-sm text-[var(--red-11)]">{error}</p>
          )}
        </div>

        <DrawerFooter>
          <Button
            onClick={handlePurchase}
            disabled={!canAfford || isPurchasing}
            className="w-full"
          >
            {isPurchasing ? 'Покупка...' : 'Купить заморозку'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
