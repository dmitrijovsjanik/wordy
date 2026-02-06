import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Lottie from 'lottie-react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon } from '@hugeicons/core-free-icons';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { useResetTimer } from '@/hooks/use-reset-timer';
import { getStreakCalendar } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { StreakActivityDay } from '@/types/api';
import fireStreakData from '@/assets/fire-streak.json';

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function MonthGrid({
  year,
  month,
  activityMap,
  today,
  streakDays,
}: {
  year: number;
  month: number;
  activityMap: Map<string, 'play' | 'freeze'>;
  today: string;
  streakDays: number;
}) {
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDayOfWeek = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

  const cells: Array<{ day: number; dateStr: string }> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    cells.push({ day: 0, dateStr: '' });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, dateStr });
  }

  return (
    <div>
      <div className="mb-2 text-center text-sm font-semibold">
        {MONTHS_RU[month]} {year}
      </div>
      <div className="mx-auto grid max-w-[260px] grid-cols-7 gap-1.5">
        {cells.map((cell, idx) => {
          if (cell.day === 0) return <div key={idx} className="aspect-square w-full" />;

          const activity = activityMap.get(cell.dateStr);
          const isToday = cell.dateStr === today;
          const isFuture = cell.dateStr > today;

          return (
            <div
              key={idx}
              className={cn(
                'flex aspect-square w-full items-center justify-center rounded-full text-xs',
                activity === 'play' && 'bg-[var(--orange-3)] font-semibold text-[var(--orange-11)]',
                activity === 'freeze' && 'bg-[var(--blue-3)] font-semibold text-[var(--blue-11)]',
                !activity && !isFuture && !isToday && 'text-[var(--gray-11)]',
                isFuture && 'text-[var(--gray-8)]',
                isToday && 'ring-2 font-semibold',
                isToday && streakDays > 0 && 'ring-[var(--orange-9)] bg-[var(--orange-3)] text-[var(--orange-11)]',
                isToday && streakDays === 0 && 'ring-[var(--brand-9)] text-[var(--brand-11)]',
              )}
            >
              {cell.day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StreakCalendarScroll({
  activityMap,
  monthCount,
  streakDays,
}: {
  activityMap: Map<string, 'play' | 'freeze'>;
  monthCount: number;
  streakDays: number;
}) {
  const now = new Date();
  const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;

  const months = useMemo(() => {
    const result: Array<{ year: number; month: number }> = [];
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(currentYear, currentMonth - i, 1));
      result.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
    }
    return result;
  }, [monthCount]);

  return (
    <div className="flex flex-col gap-6">
      {months.map(({ year, month }) => (
        <MonthGrid
          key={`${year}-${month}`}
          year={year}
          month={month}
          activityMap={activityMap}
          today={today}
          streakDays={streakDays}
        />
      ))}
    </div>
  );
}

type StreakInfoSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  streakDays: number;
  createdAt: string;
};

export function StreakInfoSheet({
  open,
  onOpenChange,
  streakDays,
  createdAt,
}: StreakInfoSheetProps) {
  const resetTimer = useResetTimer();
  const [activityDays, setActivityDays] = useState<StreakActivityDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Количество месяцев от регистрации до текущего
  const monthCount = useMemo(() => {
    const reg = new Date(createdAt);
    const now = new Date();
    const diff = (now.getUTCFullYear() - reg.getUTCFullYear()) * 12 + (now.getUTCMonth() - reg.getUTCMonth()) + 1;
    return Math.max(1, diff);
  }, [createdAt]);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    getStreakCalendar(monthCount)
      .then((data) => setActivityDays(data.activityDays))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [open, monthCount]);

  // Авто-скролл к текущему месяцу (вниз) при загрузке
  useEffect(() => {
    if (isLoading || !open) return;
    const el = scrollRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
        updateScrollState();
      });
    }
  }, [isLoading, open, updateScrollState]);

  const activityMap = useMemo(() => {
    const map = new Map<string, 'play' | 'freeze'>();
    for (const day of activityDays) {
      map.set(day.date, day.type as 'play' | 'freeze');
    }
    return map;
  }, [activityDays]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader>
          <div className="flex items-center justify-center">
            <Lottie
              animationData={fireStreakData}
              loop
              autoplay
              className="relative -top-[8px] h-16 w-16"
            />
            <span className="text-3xl font-bold text-[var(--orange-11)]">{streakDays}</span>
          </div>
          <DrawerTitle className="text-center">Стрик дней</DrawerTitle>
          <DrawerDescription className="text-center">
            Играйте каждый день, чтобы не потерять стрик. Заморозки защищают стрик в пропущенные дни.
          </DrawerDescription>
        </DrawerHeader>

        {/* Таймер — вне скролла */}
        <div className="px-4 py-2">
          <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--orange-3)] px-4 py-2.5">
            <HugeiconsIcon icon={Clock01Icon} size={16} className="text-[var(--orange-9)]" strokeWidth={2} />
            <span className="text-sm text-[var(--orange-11)]">
              Следующий день через <span className="font-semibold">{resetTimer}</span>
            </span>
          </div>
        </div>

        {/* Скролл-контейнер с масками */}
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="mt-2 min-h-[280px] flex-1 overflow-y-auto px-4 py-4"
          style={{
            maskImage: `linear-gradient(to bottom, ${canScrollUp ? 'transparent' : 'black'} 0%, black ${canScrollUp ? '24px' : '0px'}, black calc(100% - ${canScrollDown ? '24px' : '0px'}), ${canScrollDown ? 'transparent' : 'black'} 100%)`,
            WebkitMaskImage: `linear-gradient(to bottom, ${canScrollUp ? 'transparent' : 'black'} 0%, black ${canScrollUp ? '24px' : '0px'}, black calc(100% - ${canScrollDown ? '24px' : '0px'}), ${canScrollDown ? 'transparent' : 'black'} 100%)`,
          }}
        >
          {isLoading ? (
            <div className="flex h-[280px] items-center justify-center">
              <span className="text-sm text-[var(--gray-9)]">Загрузка...</span>
            </div>
          ) : (
            <StreakCalendarScroll
              activityMap={activityMap}
              monthCount={monthCount}
              streakDays={streakDays}
            />
          )}
        </div>

        <DrawerFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
            Понятно
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
