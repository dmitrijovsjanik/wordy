import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  PlayIcon,
  Settings02Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { useUserStore } from '@/stores/user-store';
import { useLeagueStore } from '@/stores/league-store';
import { useCollectionStore } from '@/stores/collection-store';
import { Avatar } from '@/components/ui/avatar';
import { GemsIndicator } from '@/components/ui/gems-indicator';
import { LeagueBadge } from '@/components/ui/league-badge';
import { StreakDaysIndicator } from '@/components/ui/streak-days-indicator';
import { StreakInfoSheet } from '@/components/ui/streak-info-sheet';
import { getStreakCalendar } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PILOT_FEATURES } from '@/lib/pilot-config';
import type { StreakActivityDay } from '@/types/api';
import cardVocabularyBg from '@/assets/dashboard/card-vocabulary.png';
import cardGrammarBg from '@/assets/dashboard/card-grammar.png';
import cardComprehensionBg from '@/assets/dashboard/card-comprehension.png';
import cardExpressionBg from '@/assets/dashboard/card-expression.png';

const DAY_LABELS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

type WeekDay = {
  dateStr: string;
  label: string;
  isToday: boolean;
  isFuture: boolean;
  isWeekend: boolean;
  activity: 'play' | 'freeze' | null;
};

function toDateStr(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const MONTHS_RU_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function buildWeek(activityMap: Map<string, 'play' | 'freeze'>, weekOffset: number): WeekDay[] {
  const now = new Date();
  const today = toDateStr(now);
  const utcDow = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - utcDow + weekOffset * 7,
  ));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + i));
    const dateStr = toDateStr(d);
    return {
      dateStr,
      label: DAY_LABELS_RU[i],
      isToday: dateStr === today,
      isFuture: dateStr > today,
      isWeekend: i >= 5,
      activity: activityMap.get(dateStr) ?? null,
    };
  });
}

function weekTitle(week: WeekDay[], weekOffset: number): string {
  if (weekOffset === 0) return 'Сегодня';
  const start = new Date(week[0].dateStr + 'T00:00:00Z');
  const end = new Date(week[6].dateStr + 'T00:00:00Z');
  const startStr = `${start.getUTCDate()} ${MONTHS_RU_SHORT[start.getUTCMonth()]}`;
  const endStr = `${end.getUTCDate()} ${MONTHS_RU_SHORT[end.getUTCMonth()]}`;
  return `${startStr} – ${endStr}`;
}

type WeekHeaderProps = {
  title: string;
  titleKey: number;
  slideDir: 'left' | 'right';
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
};

function WeekHeader({ title, titleKey, slideDir, onPrev, onNext, canGoNext }: WeekHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1 overflow-hidden pl-2">
        <h1
          key={titleKey}
          className={cn(
            'truncate text-[24px] font-semibold leading-[32px] text-[var(--gray-12)] animate-in fade-in duration-200',
            slideDir === 'left' ? 'slide-in-from-right-4' : 'slide-in-from-left-4',
          )}
        >
          {title}
        </h1>
      </div>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Предыдущая неделя"
        className="flex size-11 items-center justify-center rounded-full active:bg-[var(--gray-3)]"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} size={18} className="text-[var(--gray-11)]" strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        aria-label="Следующая неделя"
        className={cn(
          'flex size-11 items-center justify-center rounded-full',
          canGoNext ? 'active:bg-[var(--gray-3)]' : 'opacity-40',
        )}
      >
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} className="text-[var(--gray-11)]" strokeWidth={2} />
      </button>
    </div>
  );
}

function WeekDayCell({ day }: { day: WeekDay }) {
  const isPlayed = day.activity === 'play' || day.activity === 'freeze';

  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center gap-1 py-2',
        day.isFuture && 'opacity-40',
      )}
    >
      <div
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold leading-none',
          day.isToday && 'bg-[var(--brand-9)] text-white',
          !day.isToday && day.isWeekend && 'text-[var(--red-11)]',
          !day.isToday && !day.isWeekend && 'text-[var(--gray-11)]',
        )}
      >
        {day.label}
      </div>
      <div className="flex size-[22px] shrink-0 items-center justify-center">
        {isPlayed ? (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={18}
            className={day.activity === 'freeze' ? 'text-[var(--blue-9)]' : 'text-[var(--green-9)]'}
            strokeWidth={2}
          />
        ) : day.isToday ? (
          <div className="size-[18px] rounded-full border-2 border-dashed border-[var(--brand-9)]" />
        ) : (
          <div className="size-[18px] rounded-full border-2 border-[var(--gray-6)]" />
        )}
      </div>
    </div>
  );
}

type ModeCardProps = {
  title: string;
  subtitle: string;
  status: string;
  statusVariant?: 'default' | 'badge-done' | 'badge-start';
  backgroundImage: string;
  disabled?: boolean;
  onClick?: () => void;
};

function ModeCard({
  title,
  subtitle,
  status,
  statusVariant = 'default',
  backgroundImage,
  disabled,
  onClick,
}: ModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative flex h-full min-h-0 flex-col items-start justify-end overflow-hidden rounded-[32px] p-4 text-left transition-transform',
        !disabled && 'active:scale-[0.98]',
        disabled && 'cursor-default',
      )}
    >
      <img
        src={backgroundImage}
        alt=""
        aria-hidden
        className={cn(
          'absolute inset-0 size-full object-cover',
          disabled && 'opacity-40 saturate-0',
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent to-black/70" />

      <div className="relative flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1 text-white">
          <span className="text-xl font-semibold leading-7">{title}</span>
          <span className="text-sm leading-5">{subtitle}</span>
        </div>
        <div className="inline-flex items-center justify-center self-start rounded-full bg-white/15 px-2 py-1 backdrop-blur-2xl">
          <span className="text-sm leading-5 text-white">{status}</span>
        </div>
      </div>

      {statusVariant === 'badge-done' && (
        <div className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white">
          <HugeiconsIcon icon={Tick02Icon} size={18} className="text-[var(--gray-12)]" strokeWidth={2} />
        </div>
      )}
      {statusVariant === 'badge-start' && (
        <div className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full border border-white">
          <HugeiconsIcon icon={PlayIcon} size={18} className="text-white" strokeWidth={2} />
        </div>
      )}
    </button>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const library = useCollectionStore((s) => s.library);
  const fetchLibrary = useCollectionStore((s) => s.fetchLibrary);
  const progress = useLeagueStore((s) => s.progress);
  const fetchStatus = useLeagueStore((s) => s.fetchStatus);
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  const [activityDays, setActivityDays] = useState<StreakActivityDay[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [slideDir, setSlideDir] = useState<'left' | 'right'>('left');
  // Грузим столько месяцев, сколько нужно для покрытия weekOffset-й недели + запас.
  const monthsToFetch = Math.max(1, Math.ceil(Math.abs(weekOffset) / 4) + 1);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  useEffect(() => {
    if (PILOT_FEATURES.leagues) fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    getStreakCalendar(monthsToFetch)
      .then((data) => setActivityDays(data.activityDays))
      .catch(() => {});
  }, [monthsToFetch]);

  const week = useMemo(() => {
    const map = new Map<string, 'play' | 'freeze'>();
    for (const d of activityDays) map.set(d.date, d.type as 'play' | 'freeze');
    return buildWeek(map, weekOffset);
  }, [activityDays, weekOffset]);

  const headerTitle = useMemo(() => weekTitle(week, weekOffset), [week, weekOffset]);

  if (!user) return null;

  const tier = progress?.tier ?? 'bronze';
  const hasActiveCollection = library.some((c) => c.isActive);
  const todayDone = week.find((d) => d.isToday)?.activity != null;

  // TODO: подключить реальный счётчик L4 due (выученных слов, готовых к повторению сейчас).
  // На бэке нужна функция getReviewDueCount(userId, collectionId) в learning-service.ts —
  // COUNT WHERE state='learning' AND learning_tier='review' AND next_review_at <= NOW().
  // Затем добавить поле reviewDueCount в LibraryCollection и в ответ /api/collections/library.
  const vocabularyDueCount = 0;
  const vocabularyStatus = hasActiveCollection
    ? `Повторение ${vocabularyDueCount}`
    : 'Выберите коллекцию';

  return (
    <div className="flex h-full flex-col overflow-hidden py-4">
      <header className="flex items-center gap-3 px-8 py-4">
        <button
          onClick={() => navigate('/profile')}
          className="flex flex-1 items-center gap-3 text-left"
          aria-label="Профиль"
        >
          <Avatar src={user.avatarUrl} fallback={user.firstName} size={46} />
          <div className="flex flex-col">
            <span className="text-sm leading-5 text-[var(--gray-11)]">Привет,</span>
            <span className="text-base font-semibold leading-[22px] text-[var(--gray-12)]">
              {user.firstName}
            </span>
          </div>
        </button>
        {PILOT_FEATURES.gems && (
          <GemsIndicator
            gems={user.gems}
            freezes={user.streakFreezes}
            onClick={() => navigate('/shop')}
          />
        )}
        {PILOT_FEATURES.leagues && (
          <button
            onClick={() => navigate('/leaderboard')}
            className="shrink-0"
            aria-label="Рейтинг"
          >
            <LeagueBadge tier={tier} size="sm" showLabel={false} />
          </button>
        )}
        <StreakDaysIndicator count={user.streakDays} onClick={() => setStreakSheetOpen(true)} />
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="Настройки"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--gray-3)] active:bg-[var(--gray-4)]"
        >
          <HugeiconsIcon icon={Settings02Icon} size={18} className="text-[var(--gray-11)]" strokeWidth={2} />
        </button>
      </header>

      <section className="flex flex-col gap-3.5 overflow-hidden px-8 py-4">
        <WeekHeader
          title={headerTitle}
          titleKey={weekOffset}
          slideDir={slideDir}
          onPrev={() => {
            setSlideDir('right');
            setWeekOffset((o) => o - 1);
          }}
          onNext={() => {
            setSlideDir('left');
            setWeekOffset((o) => Math.min(0, o + 1));
          }}
          canGoNext={weekOffset < 0}
        />
        <div
          key={weekOffset}
          className={cn(
            'flex items-center gap-[17px] animate-in fade-in duration-200',
            slideDir === 'left' ? 'slide-in-from-right-4' : 'slide-in-from-left-4',
          )}
        >
          {week.map((day) => (
            <WeekDayCell key={day.dateStr} day={day} />
          ))}
        </div>
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-2 gap-2 px-4 py-4">
        <ModeCard
          title="Словарь"
          subtitle="Изучение слов"
          status={vocabularyStatus}
          statusVariant={todayDone ? 'badge-done' : undefined}
          backgroundImage={cardVocabularyBg}
          onClick={() => navigate('/vocabulary/learn')}
        />
        <ModeCard
          title="Грамматика"
          subtitle="Правила языка"
          status="Скоро"
          backgroundImage={cardGrammarBg}
          disabled
        />
        <ModeCard
          title="Понимание"
          subtitle="Чтение и слух"
          status="Скоро"
          statusVariant="badge-start"
          backgroundImage={cardComprehensionBg}
          disabled
        />
        <ModeCard
          title="Выражение"
          subtitle="Письмо и речь"
          status="Скоро"
          backgroundImage={cardExpressionBg}
          disabled
        />
      </section>

      <StreakInfoSheet
        open={streakSheetOpen}
        onOpenChange={setStreakSheetOpen}
        streakDays={user.streakDays}
        createdAt={user.createdAt}
      />
    </div>
  );
}
