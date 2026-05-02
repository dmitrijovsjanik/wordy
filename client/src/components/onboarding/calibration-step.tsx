import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type { ReviewFeedWord } from '@/types/api';
import { reviewFeedWords, learningSwipe } from '@/lib/api';
import { useTelegram } from '@/hooks/use-telegram';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WordStack } from '@/components/review/word-stack';

const CALIBRATION_TARGET = 10;

type Action = 'known' | 'unknown' | 'snooze';

const wordVariants = {
  enter: (direction: 'forward' | 'backward') => ({
    y: direction === 'forward' ? '60%' : '-60%',
    opacity: 0,
  }),
  center: { y: 0, opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/**
 * 4-й шаг онбординга: свайп-калибровка после плейсмент-теста.
 *
 * Показываем ~10 слов вокруг определённого CEFR, юзер свайпает «знаю / учить /
 * отложить». Backend пишет результат через тот же `/api/learning/swipe`,
 * который используется и в основном режиме обзора.
 *
 * Это даёт:
 *   - стартовый «слепок» лексики (для лучшего отбора в /api/learning/next)
 *   - тренировку основного жеста сразу при первом запуске
 */
export function CalibrationStep() {
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();

  const [words, setWords] = useState<ReviewFeedWord[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [meaningIndex, setMeaningIndex] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [isLoading, setIsLoading] = useState(true);

  // Загрузка одной пачки. Калибровке хватает 10-15 слов — больше тут смысла нет.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await reviewFeedWords({ limit: CALIBRATION_TARGET + 5 });
        if (!cancelled) {
          setWords(res.words);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const finish = useCallback(() => {
    navigate('/', { replace: true });
  }, [navigate]);

  const handleSwipe = useCallback((action: Action) => {
    hapticImpact(action === 'snooze' ? 'light' : 'medium');
    if (action === 'known') hapticNotification('success');

    const word = words[wordIndex];
    if (!word) return;

    if (action === 'snooze') {
      const remaining = word.meanings.slice(meaningIndex).map(m => m.meaningId);
      learningSwipe({ meaningIds: remaining, action: 'snooze' }).catch(() => {});
      setDirection('forward');
      setWordIndex(wordIndex + 1);
      setMeaningIndex(0);
      return;
    }

    const meaning = word.meanings[meaningIndex];
    if (!meaning) return;

    learningSwipe({ meaningId: meaning.meaningId, action }).catch(() => {});

    const nextMeaning = meaningIndex + 1;
    const isLast = nextMeaning >= word.meanings.length;
    if (isLast) {
      setDirection('forward');
      setWordIndex(wordIndex + 1);
      setMeaningIndex(0);
    } else {
      setMeaningIndex(nextMeaning);
    }
  }, [words, wordIndex, meaningIndex, hapticImpact, hapticNotification]);

  const handleUndo = useCallback(() => {
    // На этом шаге не позволяем undo — пользователь только знакомится с механикой
    // и калибровка должна быть быстрой. Если хочется поправить — на главной /review.
  }, []);

  // Завершаем когда обработали target-количество слов или закончился feed.
  if (wordIndex >= CALIBRATION_TARGET || (words.length > 0 && wordIndex >= words.length)) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <span className="text-4xl">&#10003;</span>
        <h2 className="mt-4 text-center text-xl font-bold text-[var(--gray-12)]">
          Калибровка готова
        </h2>
        <p className="mt-2 text-center text-sm text-[var(--gray-11)]">
          Теперь приложение знает, какие слова тебе уже знакомы.
        </p>
        <Button className="mt-8" onClick={finish}>
          К главной
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <Skeleton className="h-[60vh] w-full max-w-sm rounded-2xl" />
      </div>
    );
  }

  const currentWord = words[wordIndex];
  if (!currentWord) {
    // На случай если пул пуст — пропускаем и идём на главную.
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6">
        <p className="text-center text-sm text-[var(--gray-11)]">
          Подходящих слов пока нет. Можно начать.
        </p>
        <Button className="mt-4" onClick={finish}>К главной</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-6 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Калибровка</h1>
        <button
          onClick={finish}
          className="text-xs text-[var(--gray-11)] underline-offset-2 hover:underline"
        >
          Пропустить
        </button>
      </div>

      <p className="mt-2 text-sm text-[var(--gray-11)]">
        Свайп вправо — знаю, влево — учить, вверх — отложить.
      </p>

      <div className="relative mx-auto mt-4 flex w-full max-w-sm flex-1 items-center justify-center overflow-hidden">
        <div className="relative h-[60vh] w-full">
          <AnimatePresence custom={direction} mode="popLayout" initial={false}>
            <motion.div
              key={currentWord.wordId}
              custom={direction}
              variants={wordVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', stiffness: 220, damping: 28 }}
              className="absolute inset-0"
            >
              <WordStack
                word={currentWord}
                meaningIndex={meaningIndex}
                onSwipe={handleSwipe}
                onUndo={handleUndo}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-3 text-center text-xs text-[var(--gray-10)]">
        {wordIndex + 1} / {Math.min(words.length, CALIBRATION_TARGET)}
      </div>
    </div>
  );
}
