import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { HeartCheckIcon, UserIcon, Award01Icon, InformationCircleIcon, Tick01Icon } from '@hugeicons/core-free-icons';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { StreakFreezeDialog } from '@/components/ui/streak-freeze-dialog';
import { Button } from '@/components/ui/button';
import { getDailyRewards, type DailyRewardsResponse } from '@/lib/api';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import gemSpinData from '@/assets/gem-spin.json';
import snowflakeData from '@/assets/snowflake-freeze.json';

type ShopItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  available: boolean;
  icon: 'freeze' | 'hearts' | 'frame' | 'title';
};

const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'streak-freeze',
    title: 'Заморозка стрика',
    description: 'Защита на 1 пропущенный день',
    price: 200,
    available: true,
    icon: 'freeze',
  },
  {
    id: 'hearts-restore',
    title: 'Восстановление жизней',
    description: 'Мгновенно восстановить все жизни',
    price: 100,
    available: false,
    icon: 'hearts',
  },
  {
    id: 'profile-frame',
    title: 'Рамка профиля',
    description: 'Уникальная рамка для аватарки',
    price: 300,
    available: false,
    icon: 'frame',
  },
  {
    id: 'profile-title',
    title: 'Титул профиля',
    description: 'Эксклюзивный титул под именем',
    price: 500,
    available: false,
    icon: 'title',
  },
];

function ItemIcon({ type, className }: { type: ShopItem['icon']; className?: string }) {
  if (type === 'freeze') {
    return <Lottie animationData={snowflakeData} loop autoplay className={className} />;
  }

  const icons = {
    hearts: HeartCheckIcon,
    frame: UserIcon,
    title: Award01Icon,
  } as const;

  const colors = {
    hearts: 'text-[var(--red-9)]',
    frame: 'text-[var(--purple-9)]',
    title: 'text-[var(--amber-9)]',
  } as const;

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <HugeiconsIcon icon={icons[type]} size={28} className={colors[type]} strokeWidth={2} />
    </div>
  );
}

function DailyRewardRow({ label, value, done }: { label: string; value: string; done?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--gray-2)] px-4 py-2.5">
      <span className={`text-sm ${done ? 'text-[var(--gray-9)] line-through' : 'text-[var(--gray-11)]'}`}>{label}</span>
      <div className="flex items-center gap-1.5">
        {done && (
          <HugeiconsIcon icon={Tick01Icon} size={14} className="text-[var(--green-9)]" strokeWidth={2} />
        )}
        <span className={`text-sm font-semibold ${done ? 'text-[var(--gray-9)]' : ''}`}>{value}</span>
      </div>
    </div>
  );
}

function ResourceInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[var(--gray-2)] px-4 py-2.5">
      <span className="text-sm text-[var(--gray-11)]">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function useResetTimer() {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    function update() {
      const now = new Date();
      const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
      const diff = tomorrow.getTime() - now.getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}ч ${m}м`);
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

export function Shop() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [resourceInfoType, setResourceInfoType] = useState<'gems' | 'freezes' | null>(null);
  const [dailyRewards, setDailyRewards] = useState<DailyRewardsResponse | null>(null);
  const resetTimer = useResetTimer();

  useBackButton(useCallback(() => navigate(-1), [navigate]));

  useEffect(() => {
    getDailyRewards().then(setDailyRewards).catch(() => {});
  }, []);

  if (!user) return null;

  const handleItemClick = (item: ShopItem) => {
    if (!item.available) return;
    if (item.id === 'streak-freeze') {
      setFreezeDialogOpen(true);
    }
  };

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <h1 className="text-xl font-bold">Магазин</h1>

      {/* Баланс */}
      <div className="flex gap-2">
        <div
          onClick={() => setResourceInfoType('gems')}
          className="flex flex-1 cursor-pointer items-center gap-2 rounded-2xl bg-[var(--blue-3)] px-4 py-3 active:bg-[var(--blue-4)]"
        >
          <Lottie animationData={gemSpinData} loop autoplay className="h-7 w-7 shrink-0" />
          <div className="flex flex-1 flex-col items-start">
            <span className="text-lg font-bold leading-tight text-[var(--blue-11)]">{user.gems}</span>
            <span className="text-[11px] leading-tight text-[var(--blue-11)]">кристаллов</span>
          </div>
          <HugeiconsIcon icon={InformationCircleIcon} size={16} className="shrink-0 text-[var(--blue-8)]" strokeWidth={1.5} />
        </div>

        <div
          onClick={() => setResourceInfoType('freezes')}
          className="flex flex-1 cursor-pointer items-center gap-2 rounded-2xl bg-[var(--blue-3)] px-4 py-3 active:bg-[var(--blue-4)]"
        >
          <Lottie animationData={snowflakeData} loop autoplay className="h-7 w-7 shrink-0" />
          <div className="flex flex-1 flex-col items-start">
            <span className="text-lg font-bold leading-tight text-[var(--sky-11)]">{user.streakFreezes}</span>
            <span className="text-[11px] leading-tight text-[var(--sky-11)]">заморозок</span>
          </div>
          <HugeiconsIcon icon={InformationCircleIcon} size={16} className="shrink-0 text-[var(--blue-8)]" strokeWidth={1.5} />
        </div>
      </div>

      {/* Товары */}
      <div className="flex flex-col gap-2">
        {SHOP_ITEMS.map((item) => {
          const canAfford = user.gems >= item.price;

          return (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              disabled={!item.available}
              className="flex w-full items-center gap-3 rounded-2xl bg-[var(--gray-2)] px-4 py-3 text-left transition-colors active:bg-[var(--gray-3)] disabled:opacity-50"
            >
              <ItemIcon type={item.icon} className="h-10 w-10 shrink-0" />

              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">{item.title}</span>
                <span className="text-xs text-[var(--gray-11)]">{item.description}</span>
              </div>

              {item.available ? (
                <div className="flex items-center gap-1">
                  <Lottie animationData={gemSpinData} loop autoplay className="h-5 w-5 shrink-0" />
                  <span className={`text-sm font-semibold ${canAfford ? 'text-[var(--blue-11)]' : 'text-[var(--red-11)]'}`}>
                    {item.price}
                  </span>
                </div>
              ) : (
                <span className="rounded-full bg-[var(--gray-4)] px-2.5 py-1 text-[10px] font-medium text-[var(--gray-11)]">
                  Скоро
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sheet покупки заморозки */}
      <StreakFreezeDialog
        open={freezeDialogOpen}
        onOpenChange={setFreezeDialogOpen}
        currentFreezes={user.streakFreezes}
        currentGems={user.gems}
        onPurchaseSuccess={refreshProfile}
      />

      {/* Sheet информации о ресурсе */}
      <Drawer open={resourceInfoType !== null} onOpenChange={(open) => !open && setResourceInfoType(null)}>
        <DrawerContent>
          <DrawerHeader>
            <div className="flex justify-center">
              {resourceInfoType === 'gems' ? (
                <Lottie animationData={gemSpinData} loop autoplay className="h-16 w-16" />
              ) : (
                <Lottie animationData={snowflakeData} loop autoplay className="h-16 w-16" />
              )}
            </div>
            <DrawerTitle className="text-center">
              {resourceInfoType === 'gems' ? 'Кристаллы' : 'Заморозки'}
            </DrawerTitle>
            <DrawerDescription className="text-center">
              {resourceInfoType === 'gems'
                ? 'Внутриигровая валюта. Зарабатывайте за игру и тратьте на товары в магазине.'
                : 'Защищают ваш стрик дней. Если вы пропустите день — заморозка потратится автоматически и стрик сохранится. Можно накопить несколько штук на случай отпуска.'}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-3">
              {resourceInfoType === 'gems' ? (
                <>
                  {/* Ежедневные награды */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-9)]">Ежедневные награды</span>
                    <span className="text-[11px] text-[var(--gray-9)]">сброс через {resetTimer}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <DailyRewardRow label="Первая игра за день" value="+5" done={dailyRewards?.dailyPlayDone} />
                    <DailyRewardRow label="Первая победа в дуэли" value="+15" done={dailyRewards?.duelWinDone} />
                    <DailyRewardRow label="10 ответов подряд" value="+5" />
                    <DailyRewardRow label="20 ответов подряд" value="+10" />
                    <DailyRewardRow label="30 ответов подряд" value="+20" />
                  </div>

                  {/* Прогресс */}
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--gray-9)]">Прогресс</span>
                  <div className="flex flex-col gap-1.5">
                    <ResourceInfoRow label="Новый уровень" value="+20" />
                    <ResourceInfoRow label="Каждые 7 дней стрика" value="+30" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <ResourceInfoRow label="Цена в магазине" value="200 💎" />
                  <ResourceInfoRow label="Защита" value="1 пропущенный день" />
                  <ResourceInfoRow label="Лимит в запасе" value="∞" />
                </div>
              )}
            </div>
          </div>

          <DrawerFooter className="relative">
            <div className="pointer-events-none absolute -top-8 right-0 left-0 h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
            <Button variant="secondary" onClick={() => setResourceInfoType(null)} className="w-full">
              Понятно
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
