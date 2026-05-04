import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { WordStack } from '@/components/review/word-stack';
import { reviewFeedNext } from '@/lib/api';
import { useUnifiedGameStore } from '@/stores/unified-game-store';
import { useTelegram } from '@/hooks/use-telegram';
import type { ReviewFeedWord } from '@/types/api';

const BATCH_SIZE = 15;
const PREFETCH_THRESHOLD = 3;

/**
 * Встроенный обзор внутри /vocabulary/learn. Запускается когда активная
 * колода пуста и pending_pool < poolMinForResume. Цель — собрать пул, чтобы
 * /api/learning/next сразу же при следующем запросе сделал drawFromPool и
 * вернул карточку обучения.
 *
 * Намеренно НЕ переиспользует useReviewStore / review-page: эти связаны
 * с маршрутом /review и навигацией. Здесь свой минимальный state-менеджмент,
 * чтобы изолированный обзор и встроенный не делили состояние.
 *
 * Жесты «учить / знаю / отложить» работают; жест «вниз = откат» во
 * встроенном режиме отключён (WordStack принимает onUndo, передаём no-op).
 */
export function EmbeddedReview() {
  const navigate = useNavigate();
  const { hapticImpact } = useTelegram();
  const mode = useUnifiedGameStore((s) => s.mode);
  const embeddedReviewSwipe = useUnifiedGameStore((s) => s.embeddedReviewSwipe);
  const embeddedPoolSize = useUnifiedGameStore((s) => s.embeddedPoolSize);
  const embeddedPoolMinForResume = useUnifiedGameStore((s) => s.embeddedPoolMinForResume);

  const [words, setWords] = useState<ReviewFeedWord[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);

  // Загрузка батча (используется и для initial, и для prefetch).
  const loadBatch = useCallback(async (excludeWordIds: number[]): Promise<ReviewFeedWord[] | null> => {
    try {
      const res = await reviewFeedNext({ limit: BATCH_SIZE, excludeWordIds });
      return res.words;
    } catch {
      return null;
    }
  }, []);

  // Initial fetch при mount или возврате в режим embedded.
  useEffect(() => {
    if (mode !== 'embedded_review') return;
    if (words.length > 0) return;
    setIsLoadingFeed(true);
    setFeedError(null);
    loadBatch([]).then((batch) => {
      if (batch === null) {
        setFeedError('Не удалось загрузить слова для обзора');
      } else {
        setWords(batch);
      }
      setIsLoadingFeed(false);
    });
  }, [mode, words.length, loadBatch]);

  // Prefetch следующего батча при приближении к концу.
  useEffect(() => {
    if (mode !== 'embedded_review') return;
    if (isPrefetching) return;
    if (words.length === 0) return;
    const remaining = words.length - 1 - wordIndex;
    if (remaining > PREFETCH_THRESHOLD) return;
    setIsPrefetching(true);
    const seenIds = words.map((w) => w.wordId);
    loadBatch(seenIds).then((batch) => {
      if (batch && batch.length > 0) {
        setWords((prev) => [...prev, ...batch]);
      }
      setIsPrefetching(false);
    });
  }, [mode, wordIndex, words, isPrefetching, loadBatch]);

  const handleSwipe = useCallback(async (action: 'known' | 'unknown' | 'snooze') => {
    const word = words[wordIndex];
    if (!word) return;
    hapticImpact('light');
    // Шлём на сервер свайп. embeddedReviewSwipe сам решает выходить ли из
    // режима обзора (если poolSize ≥ poolMinForResume). Решение применяется
    // к слову целиком (state на word, а не на meaning).
    await embeddedReviewSwipe(word.wordId, action);
    setWordIndex((i) => i + 1);
  }, [words, wordIndex, hapticImpact, embeddedReviewSwipe]);

  // ── empty stub ──────────────────────────────────────────────────────────
  if (mode === 'embedded_review_empty') {
    return (
      <div className="relative z-[2] flex h-full flex-col px-4 pt-4 pb-4">
        <div className="mb-2 flex items-center">
          <BackButton onClick={() => navigate('/vocabulary')} variant="ghost" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="text-lg font-semibold text-[var(--gray-12)]">
            Вы прошли все доступные слова
          </div>
          <p className="text-sm text-[var(--gray-11)]">
            Ждите обновления словаря.
          </p>
          <Button variant="primary" onClick={() => navigate('/vocabulary')}>
            Назад в вокабуляр
          </Button>
        </div>
      </div>
    );
  }

  const currentWord = words[wordIndex];

  return (
    <div className="relative z-[2] flex h-full flex-col px-4 pt-4 pb-4">
      {/* Header: back + заголовок-плейсхолдер + индикатор прогресса пула. */}
      <div className="mb-2 flex items-center gap-3">
        <BackButton onClick={() => navigate('/vocabulary')} variant="ghost" />
        <div className="flex flex-1 flex-col items-center">
          <div className="text-sm font-semibold text-[var(--gray-12)]">
            Добавим новых слов
          </div>
          <div className="text-[10px] text-[var(--gray-11)]">
            {embeddedPoolSize} / {embeddedPoolMinForResume}
          </div>
        </div>
        <div className="w-10" />
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col items-center justify-center">
        {isLoadingFeed && words.length === 0 && (
          <Skeleton className="h-[60vh] w-full max-w-sm rounded-lg" />
        )}

        {feedError && !isLoadingFeed && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[var(--gray-11)]">{feedError}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setWords([]);
                setWordIndex(0);
                setMeaningIndex(0);
              }}
            >
              Попробовать снова
            </Button>
          </div>
        )}

        {!isLoadingFeed && !feedError && currentWord && (
          <div className="w-full max-w-sm">
            <WordStack
              key={`embedded-${currentWord.wordId}`}
              word={currentWord}
              onSwipe={handleSwipe}
              onUndo={() => { /* no-op в embedded режиме */ }}
            />
          </div>
        )}

        {!isLoadingFeed && !feedError && !currentWord && (
          // Дошли до конца загруженных слов и prefetch ничего не вернул —
          // фид исчерпан в рамках текущей сессии. Дополнительно запросов
          // не делаем, показываем простую заглушку.
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-[var(--gray-11)]">
              Слова закончились. Попробуйте обновить позже.
            </p>
            <Button variant="secondary" onClick={() => navigate('/vocabulary')}>
              Назад в вокабуляр
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
