import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useLeagueStore } from '@/stores/league-store';
import { Avatar } from '@/components/ui/avatar';
import { GemsIndicator } from '@/components/ui/gems-indicator';
import { LeagueBadge } from '@/components/ui/league-badge';
import { StreakDaysIndicator } from '@/components/ui/streak-days-indicator';
import { StreakInfoSheet } from '@/components/ui/streak-info-sheet';
import { BackButton } from '@/components/ui/back-button';
import { useBackButton } from '@/hooks/use-back-button';

type Card = {
  key: string;
  title: string;
  description: string;
  navigateTo: string;
};

const ACTIVITY_CARDS: Card[] = [
  {
    key: 'review',
    title: 'Обзор слов',
    description: 'Свайпом отмечай знакомое и новое.',
    navigateTo: '/review',
  },
  {
    key: 'collections',
    title: 'Коллекции',
    description: 'Управляй словарным пулом для лестницы.',
    navigateTo: '/collections',
  },
];

export function VocabularySection() {
  const navigate = useNavigate();
  const user = useUserStore((s) => s.user);
  const progress = useLeagueStore((s) => s.progress);
  const fetchStatus = useLeagueStore((s) => s.fetchStatus);
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);

  useBackButton(() => navigate('/'));

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (!user) return null;
  const tier = progress?.tier ?? 'bronze';

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-4">
      {/* Header: Back | Gems (center) | League | Streak | Avatar */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => navigate('/')} variant="ghost" />
        <div className="flex flex-1 justify-center">
          <GemsIndicator
            gems={user.gems}
            freezes={user.streakFreezes}
            onClick={() => navigate('/shop')}
          />
        </div>
        <button
          onClick={() => navigate('/leaderboard')}
          className="shrink-0"
          aria-label="Рейтинг"
        >
          <LeagueBadge tier={tier} size="sm" showLabel={false} />
        </button>
        <StreakDaysIndicator count={user.streakDays} onClick={() => setStreakSheetOpen(true)} />
        <button onClick={() => navigate('/profile')} className="shrink-0">
          <Avatar src={user.avatarUrl} fallback={user.firstName} size={40} />
        </button>
      </div>

      <h1 className="text-xl font-bold">Вокабуляр</h1>

      {/* Большая карточка — главная активность раздела */}
      <button
        type="button"
        onClick={() => navigate('/vocabulary/learn')}
        className="flex flex-col gap-2 rounded-2xl bg-[var(--brand-3)] px-5 py-5 text-left transition-colors active:bg-[var(--brand-4)]"
      >
        <span className="text-base font-bold text-[var(--brand-12)]">Учить слова</span>
        <span className="text-xs text-[var(--brand-11)]">
          Знакомство, узнавание, припоминание и контекст. Слово проходит через все уровни лестницы.
        </span>
        <span className="text-[10px] text-[var(--brand-10)]">Уровень будет здесь</span>
      </button>

      {/* Обычные карточки активностей раздела */}
      <div className="flex flex-col gap-2">
        {ACTIVITY_CARDS.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => navigate(card.navigateTo)}
            className="flex flex-col gap-1 rounded-2xl bg-[var(--gray-2)] px-4 py-3 text-left transition-colors active:bg-[var(--gray-3)]"
          >
            <span className="text-sm font-semibold">{card.title}</span>
            <span className="text-xs text-[var(--gray-11)]">{card.description}</span>
          </button>
        ))}
      </div>

      <StreakInfoSheet
        open={streakSheetOpen}
        onOpenChange={setStreakSheetOpen}
        streakDays={user.streakDays}
        createdAt={user.createdAt}
      />
    </div>
  );
}
