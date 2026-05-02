import { useState, type ReactNode } from 'react';
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
import { useTelegram } from '@/hooks/use-telegram';
import gemSpinData from '@/assets/gem-spin.json';

type ShopPurchaseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  icon: ReactNode;
  title: string;
  description: string;
  gemPrice: number;
  rubPrice: number;
  currentGems: number;
  onPurchaseGems: () => Promise<void>;
  onPurchaseRub: () => Promise<void>;
};

export function ShopPurchaseDialog({
  open,
  onOpenChange,
  icon,
  title,
  description,
  gemPrice,
  rubPrice,
  currentGems,
  onPurchaseGems,
  onPurchaseRub,
}: ShopPurchaseDialogProps) {
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { hapticNotification } = useTelegram();

  const canAfford = currentGems >= gemPrice;

  const handleGems = async () => {
    if (!canAfford) return;
    setIsPurchasing(true);
    setError(null);
    try {
      await onPurchaseGems();
      hapticNotification('success');
      onOpenChange(false);
    } catch (err) {
      hapticNotification('error');
      setError(err instanceof Error ? err.message : 'Ошибка при покупке');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRub = async () => {
    setIsPurchasing(true);
    setError(null);
    try {
      await onPurchaseRub();
      onOpenChange(false);
    } catch (err) {
      hapticNotification('error');
      setError(err instanceof Error ? err.message : 'Ошибка создания платежа');
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <div className="flex justify-center">
            {icon}
          </div>
          <DrawerTitle className="text-center">{title}</DrawerTitle>
          <DrawerDescription className="text-center">{description}</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-3 px-4">
          {/* За кристаллы */}
          <button
            onClick={handleGems}
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
              {gemPrice}
            </span>
          </button>

          {/* За рубли */}
          <button
            onClick={handleRub}
            disabled={isPurchasing}
            className="flex items-center gap-3 rounded-2xl bg-[var(--gray-2)] px-4 py-3.5 transition-colors active:bg-[var(--gray-3)] disabled:opacity-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-lg">₽</span>
            <div className="flex flex-1 flex-col items-start">
              <span className="text-sm font-semibold">За рубли</span>
            </div>
            <span className="text-lg font-bold text-[var(--gray-12)]">
              {rubPrice} ₽
            </span>
          </button>

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
