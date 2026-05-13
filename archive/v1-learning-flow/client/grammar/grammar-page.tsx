import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '@/hooks/use-back-button';
import { BackButton } from '@/components/ui/back-button';

type Card = {
  key: string;
  title: string;
  description: string;
  navigateTo: string;
};

const ACTIVITY_CARDS: Card[] = [
  {
    key: 'articles',
    title: 'Артикли',
    description: 'Когда a / an / the, а когда — без артикля.',
    navigateTo: '/grammar/articles',
  },
  {
    key: 'tenses',
    title: 'Времена',
    description: 'Формы и сигнальные слова английских времён.',
    navigateTo: '/grammar/tenses',
  },
];

/** /grammar — экран раздела Грамматика. Агрегатор: карточки активностей. */
export function GrammarPage() {
  const navigate = useNavigate();
  const goBack = useCallback(() => navigate('/'), [navigate]);
  useBackButton(goBack);

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={goBack} variant="ghost" />
        <h1 className="text-xl font-bold">Грамматика</h1>
      </div>

      <div className="mt-4 flex flex-col gap-2">
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
    </div>
  );
}
