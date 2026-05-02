import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useReviewStore } from '@/stores/review-store';
import { useTelegram } from '@/hooks/use-telegram';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { ReviewCard } from './review-card';
import { WordStack } from './word-stack';
import { cn } from '@/lib/utils';

// Variants для вертикальной карусели слов. Текущая верхняя карта улетает
// независимо (drag-driven, см. word-stack), поэтому здесь только enter:
// новая стопка появляется снизу при forward, сверху при backward.
// Exit делаем минимальный fade — старая стопка под улетевшей картой просто исчезает.
const wordVariants = {
  enter: (direction: 'forward' | 'backward') => ({
    y: direction === 'forward' ? '60%' : '-60%',
    opacity: 0,
  }),
  center: { y: 0, opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Режим обзора. Два режима, переключаются toggle'ом сверху:
 *   A — по словам (стопка значений внутри слова, дефолт)
 *   B — по значениям (плоский поток, по 1 meaning'у на карточку)
 *
 * Жесты:
 *   вправо → знаю, влево → учить, вверх → отложить (skip всей стопки в A),
 *   вниз → назад (undo).
 *
 * Feed бесконечный: store фоном подгружает следующие пачки. Счётчик не
 * показываем — это поток, как лента.
 */
export function ReviewPage() {
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();
  const {
    mode,
    words,
    wordIndex,
    meaningIndex,
    cards,
    cardIndex,
    isLoading,
    error,
    wordTransitionDirection,
    setMode,
    fetchInitial,
    swipe,
    undo,
    reset,
  } = useReviewStore();

  useBackButton(useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]));

  useEffect(() => {
    fetchInitial();
    return () => reset();
  }, [fetchInitial, reset]);

  const handleSwipe = useCallback((action: 'known' | 'unknown' | 'snooze') => {
    hapticImpact(action === 'snooze' ? 'light' : 'medium');
    if (action === 'known') hapticNotification('success');
    swipe(action);
  }, [swipe, hapticImpact, hapticNotification]);

  const handleUndo = useCallback(() => {
    hapticImpact('light');
    undo();
  }, [undo, hapticImpact]);

  const isEmpty = mode === 'A'
    ? !words[wordIndex]
    : !cards[cardIndex];

  if (isLoading && isEmpty) {
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
        <div className="mt-auto mb-auto flex flex-col items-center gap-4">
          <h2 className="text-lg font-semibold">Не удалось загрузить</h2>
          <Button onClick={() => fetchInitial()}>Попробовать снова</Button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex min-h-full flex-col items-center px-4 pt-6 pb-8">
        <div className="w-full"><BackButton onClick={() => navigate('/')} /></div>
        <div className="mt-auto mb-auto flex flex-col items-center gap-4">
          <p className="text-center text-sm text-[var(--gray-11)]">
            Пока всё. Возвращайся позже.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-8">
      <div className="w-full"><BackButton onClick={() => navigate('/')} /></div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Обзор</h1>
        {/* Toggle между режимами */}
        <div className="inline-flex rounded-full bg-[var(--gray-3)] p-0.5 text-xs">
          <button
            onClick={() => setMode('A')}
            className={cn('rounded-full px-3 py-1 transition-colors', mode === 'A' ? 'bg-[var(--gray-1)] font-semibold' : 'text-[var(--gray-11)]')}
          >
            По словам
          </button>
          <button
            onClick={() => setMode('B')}
            className={cn('rounded-full px-3 py-1 transition-colors', mode === 'B' ? 'bg-[var(--gray-1)] font-semibold' : 'text-[var(--gray-11)]')}
          >
            По значениям
          </button>
        </div>
      </div>

      <div className="relative mx-auto mt-4 flex w-full max-w-sm flex-1 items-center justify-center overflow-hidden">
        {mode === 'A' ? (
          <div className="relative h-[60vh] w-full">
            <AnimatePresence custom={wordTransitionDirection} mode="popLayout" initial={false}>
              <motion.div
                key={words[wordIndex]!.wordId}
                custom={wordTransitionDirection}
                variants={wordVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                className="absolute inset-0"
              >
                <WordStack
                  word={words[wordIndex]!}
                  meaningIndex={meaningIndex}
                  onSwipe={handleSwipe}
                  onUndo={handleUndo}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="relative h-[60vh] w-full">
            {cards.slice(cardIndex, cardIndex + 3).map((card, idx) => (
              <ReviewCard
                key={card.meaningId}
                card={card}
                onSwipe={handleSwipe}
                isTop={idx === 0}
                offset={idx}
              />
            ))}
          </div>
        )}
      </div>

      {/* Кнопочный fallback. Skip / undo / known / unknown — для accessibility и при сложностях со свайпами. */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Button variant="secondary" onClick={() => handleSwipe('unknown')} className="text-xs">Учить</Button>
        <Button variant="secondary" onClick={() => handleSwipe('snooze')} className="text-xs">Отложить</Button>
        <Button variant="secondary" onClick={handleUndo} className="text-xs">Назад</Button>
        <Button variant="secondary" onClick={() => handleSwipe('known')} className="text-xs">Знаю</Button>
      </div>
    </div>
  );
}
