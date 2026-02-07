import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCollectionStore } from '@/stores/collection-store';
import { cn } from '@/lib/utils';
import type { CefrLevel } from '@/types/api';

const LEVEL_DESCRIPTIONS: Record<CefrLevel, string> = {
  a1: 'Базовые слова для начинающих',
  a2: 'Простая лексика для общения',
  b1: 'Слова для уверенного общения',
  b2: 'Продвинутая лексика',
  c1: 'Профессиональный уровень',
};

const LEVEL_STYLES: Record<CefrLevel, { bg: string; iconBg: string; border: string; text: string }> = {
  a1: { bg: 'bg-[var(--cyan-3)]', iconBg: 'bg-[var(--cyan-6)]', border: 'border-[var(--cyan-7)]', text: 'text-[var(--cyan-11)]' },
  a2: { bg: 'bg-[var(--teal-3)]', iconBg: 'bg-[var(--teal-6)]', border: 'border-[var(--teal-7)]', text: 'text-[var(--teal-11)]' },
  b1: { bg: 'bg-[var(--iris-3)]', iconBg: 'bg-[var(--iris-6)]', border: 'border-[var(--iris-7)]', text: 'text-[var(--iris-11)]' },
  b2: { bg: 'bg-[var(--plum-3)]', iconBg: 'bg-[var(--plum-6)]', border: 'border-[var(--plum-7)]', text: 'text-[var(--plum-11)]' },
  c1: { bg: 'bg-[var(--violet-3)]', iconBg: 'bg-[var(--violet-6)]', border: 'border-[var(--violet-7)]', text: 'text-[var(--violet-11)]' },
};

type WelcomeDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCollectionAdded: () => void;
};

export function WelcomeDrawer({ open, onOpenChange, onCollectionAdded }: WelcomeDrawerProps) {
  const marketplace = useCollectionStore((s) => s.marketplace);
  const isLoadingMarketplace = useCollectionStore((s) => s.isLoadingMarketplace);
  const fetchMarketplace = useCollectionStore((s) => s.fetchMarketplace);
  const subscribe = useCollectionStore((s) => s.subscribe);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (open) fetchMarketplace();
  }, [open, fetchMarketplace]);

  // Находим коллекции из группы "level"
  const levelGroup = marketplace.find((g) => g.key === 'level');
  const levelCollections = (levelGroup?.collections ?? [])
    .filter((c) => c.cefrLevel && ['a1', 'a2', 'b1', 'b2'].includes(c.cefrLevel))
    .sort((a, b) => {
      const order: CefrLevel[] = ['a1', 'a2', 'b1', 'b2'];
      return order.indexOf(a.cefrLevel!) - order.indexOf(b.cefrLevel!);
    });

  const handleSubscribe = async () => {
    if (!selectedId) return;
    setIsSubscribing(true);
    try {
      await subscribe(selectedId);
      onCollectionAdded();
      onOpenChange(false);
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-lg">Выберите уровень</DrawerTitle>
          <DrawerDescription>
            Для эффективного обучения добавьте коллекцию слов по вашему уровню английского
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-2 px-4">
          {isLoadingMarketplace && (
            <>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </>
          )}

          {!isLoadingMarketplace && levelCollections.map((col) => {
            const level = col.cefrLevel!;
            const style = LEVEL_STYLES[level];
            const isSelected = selectedId === col.id;

            return (
              <button
                key={col.id}
                type="button"
                className={cn(
                  'flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors',
                  isSelected
                    ? `${style.bg} ${style.border}`
                    : 'border-transparent bg-[var(--gray-2)] active:bg-[var(--gray-3)]',
                )}
                onClick={() => setSelectedId(col.id)}
              >
                <div className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  isSelected ? style.iconBg : 'bg-[var(--gray-3)]',
                )}>
                  <span className={cn(
                    'text-sm font-bold',
                    isSelected ? style.text : 'text-[var(--gray-11)]',
                  )}>
                    {level.toUpperCase()}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium text-[var(--gray-12)]">{col.title}</span>
                  <span className="text-xs text-[var(--gray-11)]">
                    {LEVEL_DESCRIPTIONS[level]} · {col.totalWords} слов
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <DrawerFooter>
          <Button
            className="w-full"
            disabled={!selectedId || isSubscribing}
            onClick={handleSubscribe}
          >
            {isSubscribing ? 'Добавляю...' : 'Начать обучение'}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Пропустить
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
