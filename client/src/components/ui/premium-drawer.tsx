import { useState } from 'react';
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
import {
  Book02Icon,
  Award01Icon,
  Fire02Icon,
  StarIcon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

type LimitType = 'collections' | 'words';

type PremiumDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  limitType: LimitType;
};

const BENEFITS = [
  {
    icon: Book02Icon,
    color: 'text-[var(--brand-11)]',
    bg: 'bg-[var(--brand-3)]',
    title: 'Безлимит коллекций и слов',
    description: 'Создавайте сколько угодно коллекций и добавляйте любое количество слов',
  },
  {
    icon: Award01Icon,
    color: 'text-[var(--amber-11)]',
    bg: 'bg-[var(--amber-3)]',
    title: 'x2 ежедневные награды',
    description: 'Получайте вдвое больше кристаллов за ежедневную активность',
  },
  {
    icon: StarIcon,
    color: 'text-[var(--iris-11)]',
    bg: 'bg-[var(--iris-3)]',
    title: '+15% к получаемому опыту',
    description: 'Прокачивайте уровень быстрее с бонусом к XP за каждый ответ',
  },
  {
    icon: Fire02Icon,
    color: 'text-[var(--cyan-11)]',
    bg: 'bg-[var(--cyan-3)]',
    title: 'Заморозка стрика каждую неделю',
    description: 'Одна бесплатная заморозка в неделю — не бойтесь пропустить день',
  },
];

const MONTH_PRICE = 299;
const YEAR_MONTHLY_PRICE = 199;
const YEAR_PRICE = YEAR_MONTHLY_PRICE * 12;
const DISCOUNT = Math.round((1 - YEAR_MONTHLY_PRICE / MONTH_PRICE) * 100);

type Plan = 'month' | 'year';

export function PremiumDrawer({ open, onOpenChange, limitType }: PremiumDrawerProps) {
  const [selectedPlan, setSelectedPlan] = useState<Plan>('year');

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle className="text-center">Wordy Premium</DrawerTitle>
          <DrawerDescription className="text-center">
            {limitType === 'collections'
              ? 'Вы достигли лимита бесплатного плана — 1 коллекция. Оформите подписку, чтобы снять ограничения.'
              : 'Вы достигли лимита бесплатного плана — 50 слов. Оформите подписку, чтобы снять ограничения.'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 px-6 py-2">
          {/* Преимущества */}
          <div className="flex flex-col gap-3">
            {BENEFITS.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', b.bg)}>
                  <HugeiconsIcon icon={b.icon} size={18} className={b.color} strokeWidth={2} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-[var(--gray-12)]">{b.title}</span>
                  <span className="text-xs leading-snug text-[var(--gray-11)]">{b.description}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Выбор плана */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedPlan('month')}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 transition-colors',
                selectedPlan === 'month'
                  ? 'border-[var(--brand-9)] bg-[var(--brand-3)]'
                  : 'border-[var(--gray-6)] bg-[var(--gray-2)]',
              )}
            >
              <span className="text-xs font-medium text-[var(--gray-11)]">1 месяц</span>
              <span className="text-lg font-bold text-[var(--gray-12)]">
                {MONTH_PRICE}₽
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPlan('year')}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 transition-colors',
                selectedPlan === 'year'
                  ? 'border-[var(--brand-9)] bg-[var(--brand-3)]'
                  : 'border-[var(--gray-6)] bg-[var(--gray-2)]',
              )}
            >
              <span className="absolute -top-2.5 rounded-full bg-[var(--brand-9)] px-2 py-0.5 text-[10px] font-semibold text-white">
                -{DISCOUNT}%
              </span>
              <span className="text-xs font-medium text-[var(--gray-11)]">12 месяцев</span>
              <span className="text-lg font-bold text-[var(--gray-12)]">
                {YEAR_PRICE.toLocaleString('ru-RU')}₽
              </span>
              <span className="text-xs text-[var(--gray-11)]">
                {YEAR_MONTHLY_PRICE}₽/мес
              </span>
            </button>
          </div>
        </div>

        <DrawerFooter>
          <Button disabled className="w-full">
            Скоро
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
            Понятно
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
