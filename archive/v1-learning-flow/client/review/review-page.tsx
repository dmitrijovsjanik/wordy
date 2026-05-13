import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useReviewStore } from '@/stores/review-store';
import { useTelegram } from '@/hooks/use-telegram';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { WordStack } from './word-stack';

// Variants для вертикальной карусели слов. Текущая карта улетает независимо
// (drag-driven, см. word-stack), здесь только enter — новое слово появляется
// снизу при forward, сверху при backward (после undo).
const wordVariants = {
  enter: (direction: 'forward' | 'backward') => ({
    y: direction === 'forward' ? '60%' : '-60%',
    opacity: 0,
  }),
  center: { y: 0, opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * Изолированный режим обзора (этап 3, единый режим).
 *
 * Карточка = слово + все его eligible meanings строкой через точку с запятой.
 * Свайп — решение по слову целиком. Жесты: вправо/влево/вверх/вниз
 * (см. WordStack). Feed бесконечный, store фоном подгружает следующие пачки.
 */
export function ReviewPage() {
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();
  const {
    words,
    wordIndex,
    isLoading,
    error,
    wordTransitionDirection,
    fetchInitial,
    swipe,
    undo,
    reset,
  } = useReviewStore();

  useBackButton(useCallback(() => {
    reset();
    navigate('/vocabulary');
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

  const currentWord = words[wordIndex];
  const isEmpty = !currentWord;

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-8">
      <div className="w-full"><BackButton onClick={() => navigate('/vocabulary')} /></div>

      <div className="mt-2 flex items-center">
        <h1 className="text-lg font-semibold">Обзор</h1>
      </div>

      <div className="relative mx-auto mt-4 flex w-full max-w-sm flex-1 items-center justify-center overflow-hidden">
        <div className="relative h-[60vh] w-full">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <p className="text-sm text-[var(--gray-11)]">Не удалось загрузить</p>
              <Button onClick={() => fetchInitial()}>Попробовать снова</Button>
            </div>
          ) : isLoading && isEmpty ? (
            <Skeleton className="h-full w-full rounded-2xl" />
          ) : isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center">
              <p className="text-center text-sm text-[var(--gray-11)]">
                Пока всё. Возвращайся позже.
              </p>
            </div>
          ) : (
            <AnimatePresence custom={wordTransitionDirection} mode="popLayout" initial={false}>
              <motion.div
                key={`word-${currentWord.wordId}`}
                custom={wordTransitionDirection}
                variants={wordVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                className="absolute inset-0"
              >
                <WordStack
                  word={currentWord}
                  onSwipe={handleSwipe}
                  onUndo={handleUndo}
                />
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Кнопочный fallback. Цветовое кодирование совпадает с ripple-заливкой. */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        <Button variant="destructive" onClick={() => handleSwipe('unknown')} className="text-xs">Учить</Button>
        <Button variant="secondary" onClick={() => handleSwipe('snooze')} className="text-xs">Отложить</Button>
        <Button variant="ghost" onClick={handleUndo} className="text-xs">Назад</Button>
        <Button variant="success" onClick={() => handleSwipe('known')} className="text-xs">Знаю</Button>
      </div>
    </div>
  );
}
