import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { UserIcon, Award01Icon, InformationCircleIcon, Clock01Icon, StarIcon } from '@hugeicons/core-free-icons';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { useResetTimer } from '@/hooks/use-reset-timer';
import { StreakFreezeDialog, type FreezePack } from '@/components/ui/streak-freeze-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { getDailyRewards, getPremiumStatus, cancelAutoRenew, type DailyRewardsResponse } from '@/lib/api';
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

// ─── Паки заморозок ──────────────────────────────────────────────────────────

const FREEZE_PACKS: FreezePack[] = [
  { days: 1,  gems: 200,  rubPrice: 49  },
  { days: 2,  gems: 350,  rubPrice: 79  },
  { days: 7,  gems: 1000, rubPrice: 249 },
  { days: 14, gems: 1800, rubPrice: 449 },
];

const BASE_PRICE_PER_DAY = FREEZE_PACKS[0].gems;

const FREEZE_ITEM_TYPE_MAP: Record<number, string> = {
  1: 'freeze_1',
  2: 'freeze_2',
  7: 'freeze_7',
  14: 'freeze_14',
};

function getDiscount(pack: FreezePack): number {
  const fullPrice = BASE_PRICE_PER_DAY * pack.days;
  return Math.round(((fullPrice - pack.gems) / fullPrice) * 100);
}

function pluralizeDays(n: number): string {
  if (n === 1) return '1 день';
  if (n >= 2 && n <= 4) return `${n} дня`;
  return `${n} дней`;
}

// ─── Прочие товары (будущие) ─────────────────────────────────────────────────

type ShopItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  available: boolean;
  icon: 'frame' | 'title';
};

const SHOP_ITEMS: ShopItem[] = [
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
  const icons = {
    frame: UserIcon,
    title: Award01Icon,
  } as const;

  const colors = {
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
    <div className="flex items-center gap-3 rounded-xl bg-[var(--gray-2)] px-4 py-2.5">
      <Checkbox checked={!!done} className="pointer-events-none" />
      <span className={`flex-1 text-sm ${done ? 'text-[var(--gray-9)] line-through' : 'text-[var(--gray-11)]'}`}>{label}</span>
      <span className={`text-sm font-semibold ${done ? 'text-[var(--gray-9)]' : ''}`}>{value}</span>
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


export function Shop() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const [selectedPack, setSelectedPack] = useState<FreezePack | null>(null);
  const [resourceInfoType, setResourceInfoType] = useState<'gems' | 'freezes' | null>(null);
  const [dailyRewards, setDailyRewards] = useState<DailyRewardsResponse | null>(null);
  const [premiumStatus, setPremiumStatus] = useState<{ isPremium: boolean; premiumUntil: string | null; premiumPlan: string | null; autoRenew: boolean } | null>(null);
  const [isCancellingAutoRenew, setIsCancellingAutoRenew] = useState(false);
  const resetTimer = useResetTimer();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useBackButton(useCallback(() => navigate(-1), [navigate]));

  useEffect(() => {
    getDailyRewards().then(setDailyRewards).catch(() => {});
    getPremiumStatus().then(setPremiumStatus).catch(() => {});

    // После возврата с YooKassa — обновить профиль
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') === 'complete') {
      window.history.replaceState({}, '', '/shop');
      refreshProfile();
      getPremiumStatus().then(setPremiumStatus).catch(() => {});
    }
  }, [refreshProfile]);

  const handleCancelAutoRenew = async () => {
    setIsCancellingAutoRenew(true);
    try {
      await cancelAutoRenew();
      setPremiumStatus((prev) => prev ? { ...prev, autoRenew: false } : prev);
    } catch {
      // ignore
    } finally {
      setIsCancellingAutoRenew(false);
    }
  };

  if (!user) return null;

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

      {/* Premium подписка */}
      {premiumStatus?.isPremium && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-9)]">
            Подписка
          </span>
          <div className="flex flex-col gap-2 rounded-2xl bg-[var(--amber-3)] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--amber-4)]">
                <HugeiconsIcon icon={StarIcon} size={18} className="text-[var(--amber-11)]" strokeWidth={2} />
              </div>
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold text-[var(--amber-12)]">Wordy Premium</span>
                <span className="text-xs text-[var(--amber-11)]">
                  до {premiumStatus.premiumUntil ? new Date(premiumStatus.premiumUntil).toLocaleDateString('ru-RU') : '—'}
                  {premiumStatus.premiumPlan === 'year' ? ' (годовая)' : ' (месячная)'}
                </span>
              </div>
            </div>
            {premiumStatus.autoRenew ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCancelAutoRenew}
                disabled={isCancellingAutoRenew}
                className="w-full"
              >
                {isCancellingAutoRenew ? 'Отключение...' : 'Отключить автопродление'}
              </Button>
            ) : (
              <p className="text-xs text-[var(--amber-11)]">
                Автопродление отключено. Подписка завершится в указанную дату.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Паки заморозок */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-9)]">
          Заморозка стрика
        </span>
        {FREEZE_PACKS.map((pack) => {
          const canAfford = user.gems >= pack.gems;
          const discount = getDiscount(pack);

          return (
            <button
              key={pack.days}
              onClick={() => setSelectedPack(pack)}
              className="flex w-full items-center gap-3 rounded-2xl bg-[var(--gray-2)] px-4 py-3 text-left transition-colors active:bg-[var(--gray-3)]"
            >
              <Lottie animationData={snowflakeData} loop autoplay className="h-9 w-9 shrink-0" />

              <span className="flex-1 text-sm font-semibold">{pluralizeDays(pack.days)}</span>

              <div className="flex items-center gap-2">
                {discount > 0 && (
                  <span className="rounded-full bg-[var(--green-3)] px-2 py-0.5 text-[11px] font-semibold text-[var(--green-11)]">
                    -{discount}%
                  </span>
                )}
                <div className="flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1">
                    <Lottie animationData={gemSpinData} loop autoplay className="h-4 w-4 shrink-0" />
                    <span className={`text-sm font-semibold ${canAfford ? 'text-[var(--blue-11)]' : 'text-[var(--red-11)]'}`}>
                      {pack.gems}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--gray-9)]">{pack.rubPrice} ₽</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Прочие товары */}
      {SHOP_ITEMS.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-9)]">
            Скоро
          </span>
          {SHOP_ITEMS.map((item) => (
            <button
              key={item.id}
              disabled
              className="flex w-full items-center gap-3 rounded-2xl bg-[var(--gray-2)] px-4 py-3 text-left opacity-50"
            >
              <ItemIcon type={item.icon} className="h-10 w-10 shrink-0" />
              <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">{item.title}</span>
                <span className="text-xs text-[var(--gray-11)]">{item.description}</span>
              </div>
              <span className="rounded-full bg-[var(--gray-4)] px-2.5 py-1 text-[10px] font-medium text-[var(--gray-11)]">
                Скоро
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Sheet покупки конкретного пака */}
      <StreakFreezeDialog
        open={selectedPack !== null}
        onOpenChange={(open) => !open && setSelectedPack(null)}
        pack={selectedPack}
        rubItemType={selectedPack ? FREEZE_ITEM_TYPE_MAP[selectedPack.days] : undefined}
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

          {/* Таймер — вне скролла */}
          {resourceInfoType === 'gems' && (
            <div className="px-4 py-2">
              <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--blue-3)] px-4 py-2.5">
                <HugeiconsIcon icon={Clock01Icon} size={16} className="text-[var(--blue-9)]" strokeWidth={2} />
                <span className="text-sm text-[var(--blue-11)]">
                  Сброс наград через <span className="font-semibold">{resetTimer}</span>
                </span>
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex-1 overflow-y-auto px-4 py-4"
            style={{
              maskImage: `linear-gradient(to bottom, ${canScrollUp ? 'transparent' : 'black'} 0%, black ${canScrollUp ? '24px' : '0px'}, black calc(100% - ${canScrollDown ? '24px' : '0px'}), ${canScrollDown ? 'transparent' : 'black'} 100%)`,
              WebkitMaskImage: `linear-gradient(to bottom, ${canScrollUp ? 'transparent' : 'black'} 0%, black ${canScrollUp ? '24px' : '0px'}, black calc(100% - ${canScrollDown ? '24px' : '0px'}), ${canScrollDown ? 'transparent' : 'black'} 100%)`,
            }}
          >
            <div className="flex flex-col gap-3">
              {resourceInfoType === 'gems' ? (
                <>
                  {/* Ежедневные награды */}
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-9)]">Ежедневные награды</span>
                  <div className="flex flex-col gap-1.5">
                    <DailyRewardRow label="Первая игра за день" value="+5" done={dailyRewards?.dailyPlayDone} />
                    <DailyRewardRow label="Первая победа в дуэли" value="+15" done={dailyRewards?.duelWinDone} />
                    <DailyRewardRow label="5 ответов подряд" value="+5" done={dailyRewards?.streakMilestonesDone.includes(5)} />
                    <DailyRewardRow label="25 правильных за день" value="+10" done={dailyRewards?.correctMilestonesDone.includes(25)} />
                    <DailyRewardRow label="50 правильных за день" value="+15" done={dailyRewards?.correctMilestonesDone.includes(50)} />
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
                  <ResourceInfoRow label="Защита" value="1 заморозка = 1 день" />
                  <ResourceInfoRow label="Активация" value="Автоматически" />
                  <ResourceInfoRow label="Лимит в запасе" value="∞" />
                </div>
              )}
            </div>
          </div>

          <DrawerFooter>
            <Button variant="secondary" onClick={() => setResourceInfoType(null)} className="w-full">
              Понятно
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
