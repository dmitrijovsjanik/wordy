import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useLeagueStore } from '@/stores/league-store';
import { useCollectionStore } from '@/stores/collection-store';
import { Avatar } from '@/components/ui/avatar';
import { GemsIndicator } from '@/components/ui/gems-indicator';
import { LeagueBadge } from '@/components/ui/league-badge';
import { StreakDaysIndicator } from '@/components/ui/streak-days-indicator';
import { StreakInfoSheet } from '@/components/ui/streak-info-sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PILOT_FEATURES } from '@/lib/pilot-config';

type SectionStatus = 'active' | 'in-progress' | 'soon';

type CoreSection = {
  key: string;
  title: string;
  description: string;
  status: SectionStatus;
  navigateTo: string | null;
};

const SYSTEMS_SECTIONS: CoreSection[] = [
  {
    key: 'vocabulary',
    title: 'Вокабуляр',
    description: 'Учим слова: знакомство, узнавание и припоминание в контексте.',
    status: 'active',
    navigateTo: '/vocabulary',
  },
  ...(PILOT_FEATURES.grammar
    ? [
        {
          key: 'grammar',
          title: 'Грамматика',
          description: 'Артикли и времена: правила и тренажёр.',
          status: 'active' as const,
          navigateTo: '/grammar',
        },
      ]
    : []),
  {
    key: 'spelling',
    title: 'Орфография',
    description: 'Правописание частотных слов английского.',
    status: 'active',
    navigateTo: '/spelling',
  },
  {
    key: 'pronunciation',
    title: 'Произношение',
    description: 'Звуки английского и постановка артикуляции.',
    status: 'in-progress',
    navigateTo: null,
  },
];

const SKILLS_SECTIONS: CoreSection[] = [
  ...(PILOT_FEATURES.reading
    ? [
        {
          key: 'reading',
          title: 'Чтение',
          description: 'Мини-тексты с проверкой понимания.',
          status: 'active' as const,
          navigateTo: '/reading',
        },
      ]
    : []),
  {
    key: 'listening',
    title: 'Аудирование',
    description: 'Понимание устной речи на слух.',
    status: 'in-progress',
    navigateTo: null,
  },
  {
    key: 'writing',
    title: 'Письмо',
    description: 'Складный письменный английский.',
    status: 'soon',
    navigateTo: null,
  },
  {
    key: 'speaking',
    title: 'Говорение',
    description: 'Свободная устная речь.',
    status: 'soon',
    navigateTo: null,
  },
];

type OtherSection = {
  key: string;
  title: string;
  description: string;
  navigateTo: string;
};

const OTHER_SECTIONS: OtherSection[] = [
  ...(PILOT_FEATURES.duels
    ? [
        {
          key: 'duel',
          title: 'Дуэли',
          description: 'Сразись с другом на скорость и точность.',
          navigateTo: '/duel/create',
        },
      ]
    : []),
  {
    key: 'quiz-legacy',
    title: 'Квиз (legacy)',
    description: 'Старый формат квиза. Будет проработан после пилота.',
    navigateTo: '/modes',
  },
];

type SectionCardProps = {
  section: CoreSection;
  isFirstTime: boolean;
};

function SectionCard({ section, isFirstTime }: SectionCardProps) {
  const navigate = useNavigate();
  const isVocabulary = section.key === 'vocabulary';
  const isInProgress = section.status === 'in-progress';
  const isSoon = section.status === 'soon';
  const isInactive = isInProgress || isSoon;

  const handleClick = () => {
    if (isInactive) return;
    if (isFirstTime && isVocabulary) {
      navigate('/collections');
      return;
    }
    if (section.navigateTo) navigate(section.navigateTo);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isInactive}
      className={cn(
        'flex flex-col gap-1.5 rounded-2xl bg-[var(--gray-2)] px-4 py-3 text-left transition-colors',
        !isInactive && 'active:bg-[var(--gray-3)]',
        isSoon && 'opacity-40 cursor-default',
        isInProgress && 'opacity-60 cursor-default',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{section.title}</span>
        {isInProgress && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            В разработке
          </Badge>
        )}
        {isSoon && (
          <Badge variant="secondary" className="shrink-0 text-[10px]">
            Скоро
          </Badge>
        )}
      </div>
      <span className="text-xs text-[var(--gray-11)]">
        {isFirstTime && isVocabulary
          ? 'Выберите коллекцию для старта'
          : section.description}
      </span>
      {section.status === 'active' && !(isFirstTime && isVocabulary) && (
        <span className="text-[10px] text-[var(--gray-10)]">Уровень будет здесь</span>
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

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (!user) return null;

  const tier = progress?.tier ?? 'bronze';
  const hasActiveCollection = library.some((c) => c.isActive);
  const isFirstTimeVocab = !hasActiveCollection;

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-4">
      {/* Header: Avatar | Gems | League | Streak */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="shrink-0">
          <Avatar src={user.avatarUrl} fallback={user.firstName} size={48} />
        </button>
        {PILOT_FEATURES.gems && (
          <div className="flex flex-1 justify-center">
            <GemsIndicator
              gems={user.gems}
              freezes={user.streakFreezes}
              onClick={() => navigate('/shop')}
            />
          </div>
        )}
        {!PILOT_FEATURES.gems && <div className="flex-1" />}
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
      </div>

      {/* Системы */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--gray-11)]">Системы</h2>
        <div className="flex flex-col gap-2">
          {SYSTEMS_SECTIONS.map((s) => (
            <SectionCard
              key={s.key}
              section={s}
              isFirstTime={s.key === 'vocabulary' ? isFirstTimeVocab : false}
            />
          ))}
        </div>
      </section>

      {/* Навыки */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--gray-11)]">Навыки</h2>
        <div className="flex flex-col gap-2">
          {SKILLS_SECTIONS.map((s) => (
            <SectionCard
              key={s.key}
              section={s}
              isFirstTime={false}
            />
          ))}
        </div>
      </section>

      {/* Другое */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--gray-11)]">Другое</h2>
        <div className="flex flex-col gap-2">
          {OTHER_SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => navigate(s.navigateTo)}
              className="flex flex-col gap-1.5 rounded-2xl bg-[var(--gray-2)] px-4 py-3 text-left transition-colors active:bg-[var(--gray-3)]"
            >
              <span className="text-sm font-semibold">{s.title}</span>
              <span className="text-xs text-[var(--gray-11)]">{s.description}</span>
            </button>
          ))}
        </div>
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
