import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewStore } from '@/stores/review-store';
import { useTelegram } from '@/hooks/use-telegram';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { ReviewCard } from './review-card';

/**
 * Режим обзора. Свайп карточек: вправо «знаю», влево «не знаю», вниз «отложить».
 * Запрашивает feed из /api/review-feed/next, пишет свайпы через /api/learning/swipe.
 *
 * Показывает 1 верхнюю карточку с жестами + 2 «фантома» позади для эффекта стопки.
 */
export function ReviewPage() {
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();
  const { cards, currentIndex, isLoading, error, fetchInitial, swipe, reset } = useReviewStore();

  useBackButton(useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]));

  useEffect(() => {
    fetchInitial();
    return () => reset();
  }, [fetchInitial, reset]);

  const handleSwipe = useCallback((action: 'known' | 'unknown' | 'snooze') => {
    hapticImpact(action === 'known' ? 'medium' : action === 'unknown' ? 'medium' : 'light');
    if (action === 'known') hapticNotification('success');
    swipe(action);
  }, [swipe, hapticImpact, hapticNotification]);

  if (isLoading && cards.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center px-4 pt-6 pb-8">
        <div className="w-full"><BackButton onClick={() => navigate('/')} /></div>
        <h1 className="mt-4 text-lg font-semibold">Обзор</h1>
        <Skeleton className="mt-8 h-[60vh] w-full max-w-sm rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center px-4 pt-6 pb-8">
        <div className="w-full"><BackButton onClick={() => navigate('/')} /></div>
        <div className="mt-auto flex flex-col items-center gap-4 mb-auto">
          <h2 className="text-lg font-semibold">Не удалось загрузить</h2>
          <Button onClick={() => fetchInitial()}>Попробовать снова</Button>
        </div>
      </div>
    );
  }

  // Очередь закончилась.
  const top = cards[currentIndex];
  if (!top) {
    return (
      <div className="flex min-h-full flex-col items-center px-4 pt-6 pb-8">
        <div className="w-full"><BackButton onClick={() => navigate('/')} /></div>
        <div className="mt-auto mb-auto flex flex-col items-center gap-4">
          <span className="text-4xl">&#10003;</span>
          <h2 className="text-center text-xl font-bold">Карточки закончились</h2>
          <p className="text-center text-sm text-[var(--gray-11)]">
            Возвращайся завтра — мы подберём новые слова.
          </p>
          <Button onClick={() => fetchInitial()}>Загрузить ещё</Button>
        </div>
      </div>
    );
  }

  // Видимый стек: top + 2 следующие карточки сзади.
  const visible = cards.slice(currentIndex, currentIndex + 3);

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-8">
      <div className="w-full"><BackButton onClick={() => navigate('/')} /></div>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Обзор</h1>
        <span className="text-sm text-[var(--gray-11)]">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      <div className="relative mx-auto mt-4 flex w-full max-w-sm flex-1 items-center justify-center">
        <div className="relative h-[60vh] w-full">
          {visible.map((card, idx) => (
            <ReviewCard
              key={card.meaningId}
              card={card}
              onSwipe={handleSwipe}
              isTop={idx === 0}
              offset={idx}
            />
          ))}
        </div>
      </div>

      {/* Кнопочный fallback внизу — для accessibility и при сложностях со свайпами в Telegram WebView. */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Button
          variant="secondary"
          onClick={() => handleSwipe('unknown')}
        >
          Учить
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleSwipe('snooze')}
        >
          Отложить
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleSwipe('known')}
        >
          Знаю
        </Button>
      </div>
    </div>
  );
}
