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
import { purchaseStreakFreeze, createPayment } from '@/lib/api';
import { useTelegram } from '@/hooks/use-telegram';
import snowflakeData from '@/assets/snowflake-freeze.json';
import gemSpinData from '@/assets/gem-spin.json';

export type FreezePack = {
  days: number;
  gems: number;
  rubPrice: number;
};

function pluralizeDays(n: number): string {
  if (n === 1) return '1 день';
  if (n >= 2 && n <= 4) return `${n} дня`;
  return `${n} дней`;
}

type StreakFreezeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pack: FreezePack | null;
  rubItemType?: string;
  currentFreezes: number;
  currentGems: number;
  onPurchaseSuccess: () => void;
};

export function StreakFreezeDialog({
  open,
  onOpenChange,
  pack,
  rubItemType,
  currentFreezes,
  currentGems,
  onPurchaseSuccess,
}: StreakFreezeDialogProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hapticNotification } = useTelegram();

  if (!pack) return null;

  const canAfford = currentGems >= pack.gems;

  const handlePurchaseGems = async () => {
    if (!canAfford) return;

    setIsPurchasing(true);
    setError(null);

    try {
      await purchaseStreakFreeze(pack.days);
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

  const handlePurchaseRub = async () => {
    if (!rubItemType) return;

    setIsPurchasing(true);
    setError(null);

    try {
      const { confirmationUrl } = await createPayment(rubItemType);
      window.open(confirmationUrl, '_blank');
      onOpenChange(false);
    } catch (err) {
      hapticNotification('error');
      const message = err instanceof Error ? err.message : 'Ошибка создания платежа';
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
            <Lottie animationData={snowflakeData} loop autoplay className="h-16 w-16" />
          </div>
          <DrawerTitle className="text-center">
            Заморозка на {pluralizeDays(pack.days)}
          </DrawerTitle>
          <DrawerDescription className="text-center">
            Защитит стрик от {pack.days === 1 ? '1 пропущенного дня' : `${pack.days} пропущенных дней`}. В запасе: {currentFreezes}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-3 px-4">
          {/* За кристаллы */}
          <button
            onClick={handlePurchaseGems}
            disabled={!canAfford || isPurchasing}
            className="flex items-center gap-3 rounded-2xl bg-[var(--gray-2)] px-4 py-3.5 transition-colors active:bg-[var(--gray-3)] disabled:opacity-50"
          >
            <Lottie animationData={gemSpinData} loop autoplay className="h-8 w-8 shrink-0" />
            <div className="flex flex-1 flex-col items-start">
              <span className="text-sm font-semibold">За кристаллы</span>
              {!canAfford && (
                <span className="text-[11px] text-[var(--red-11)]">Недостаточно кристаллов</span>
              )}
            </div>
            <span className={`text-lg font-bold ${canAfford ? 'text-[var(--blue-11)]' : 'text-[var(--red-11)]'}`}>
              {pack.gems}
            </span>
          </button>

          {/* За рубли */}
          <button
            onClick={handlePurchaseRub}
            disabled={!rubItemType || isPurchasing}
            className="flex items-center gap-3 rounded-2xl bg-[var(--gray-2)] px-4 py-3.5 transition-colors active:bg-[var(--gray-3)] disabled:opacity-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-lg">₽</span>
            <div className="flex flex-1 flex-col items-start">
              <span className="text-sm font-semibold">За рубли</span>
            </div>
            <span className="text-lg font-bold text-[var(--gray-12)]">
              {pack.rubPrice} ₽
            </span>
          </button>

          {/* Ошибка */}
          {error && (
            <p className="text-center text-sm text-[var(--red-11)]">{error}</p>
          )}
        </div>

        <DrawerFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
            {isPurchasing ? 'Покупка...' : 'Отмена'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
