import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { WordStack } from '@/components/review/word-stack';
import { AnswerHistoryDrawer } from '@/components/answer-history-drawer';
import { LearningHeader } from '@/components/game/learning-header';
import { reviewFeedNext } from '@/lib/api';
import { useUnifiedGameStore } from '@/stores/unified-game-store';
import { useTelegram } from '@/hooks/use-telegram';
import { cn } from '@/lib/utils';
import type { ReviewFeedWord } from '@/types/api';

const BATCH_SIZE = 15;
const PREFETCH_THRESHOLD = 3;

/**
 * Встроенный обзор внутри /vocabulary/learn (этап L0). Запускается когда
 * активная колода пуста и pending_pool < poolMinForResume. Цель — собрать пул,
 * чтобы /api/learning/next сразу же при следующем запросе сделал drawFromPool
 * и вернул карточку обучения.
 *
 * Свайп/тап «Знаю»/«Не знаю» делают одно и то же: вызывают embeddedReviewSwipe.
 * Жест «вверх» = отложить, «вниз» = откат (отключён в embedded режиме).
 */
export function EmbeddedReview() {
  const navigate = useNavigate();
  const { hapticImpact } = useTelegram();
  const mode = useUnifiedGameStore((s) => s.mode);
  const embeddedReviewSwipe = useUnifiedGameStore((s) => s.embeddedReviewSwipe);
  const embeddedPoolSize = useUnifiedGameStore((s) => s.embeddedPoolSize);
  const embeddedPoolMinForResume = useUnifiedGameStore((s) => s.embeddedPoolMinForResume);
  const answerHistory = useUnifiedGameStore((s) => s.answerHistory);
  const clearHistory = useUnifiedGameStore((s) => s.clearHistory);

  const [words, setWords] = useState<ReviewFeedWord[]>([]);
  const [wordIndex, setWordIndex] = useState(0);
  const [isLoadingFeed, setIsLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  // Загрузка батча (используется и для initial, и для prefetch).
  const loadBatch = useCallback(async (excludeWordIds: number[]): Promise<ReviewFeedWord[] | null> => {
    try {
      const res = await reviewFeedNext({ limit: BATCH_SIZE, excludeWordIds });
      return res.words;
    } catch {
      return null;
    }
  }, []);

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
    await embeddedReviewSwipe(word.wordId, action);
    setWordIndex((i) => i + 1);
  }, [words, wordIndex, hapticImpact, embeddedReviewSwipe]);

  // ── empty stub ──────────────────────────────────────────────────────────
  if (mode === 'embedded_review_empty') {
    return (
      <div className="flex min-h-0 flex-1 flex-col pt-4">
        <LearningHeader onHistoryClick={() => setHistoryDrawerOpen(true)} backTo="/" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-lg font-semibold text-[var(--gray-12)]">
            Вы прошли все доступные слова
          </div>
          <p className="text-sm text-[var(--gray-11)]">Ждите обновления словаря.</p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            На главную
          </Button>
        </div>
        <AnswerHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          history={answerHistory}
          onClear={clearHistory}
        />
      </div>
    );
  }

  const currentWord = words[wordIndex];

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-4">
      <LearningHeader onHistoryClick={() => setHistoryDrawerOpen(true)} backTo="/" />

      <div className="relative flex min-h-0 flex-1 flex-col px-4">
        {isLoadingFeed && words.length === 0 && (
          <Skeleton className="flex-1 rounded-[48px]" />
        )}

        {feedError && !isLoadingFeed && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-[var(--gray-11)]">{feedError}</p>
            <Button
              variant="secondary"
              onClick={() => {
                setWords([]);
                setWordIndex(0);
              }}
            >
              Попробовать снова
            </Button>
          </div>
        )}

        {!isLoadingFeed && !feedError && currentWord && (
          <div className="relative flex min-h-0 flex-1 flex-col">
            <WordStack
              key={`embedded-${currentWord.wordId}`}
              word={currentWord}
              onSwipe={handleSwipe}
              onUndo={() => { /* no-op в embedded режиме */ }}
            />
          </div>
        )}

        {!isLoadingFeed && !feedError && !currentWord && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-[var(--gray-11)]">
              Слова закончились. Попробуйте обновить позже.
            </p>
            <Button variant="secondary" onClick={() => navigate('/')}>
              На главную
            </Button>
          </div>
        )}
      </div>

      <Footer
        onUnknown={() => currentWord && handleSwipe('unknown')}
        onKnown={() => currentWord && handleSwipe('known')}
        disabled={!currentWord || isLoadingFeed}
        poolProgress={embeddedPoolSize !== undefined && embeddedPoolMinForResume !== undefined
          ? { current: embeddedPoolSize, target: embeddedPoolMinForResume }
          : null}
      />

      <AnswerHistoryDrawer
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
        history={answerHistory}
        onClear={clearHistory}
      />
    </div>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

type FooterProps = {
  onUnknown: () => void;
  onKnown: () => void;
  disabled: boolean;
  poolProgress: { current: number; target: number } | null;
};

function Footer({ onUnknown, onKnown, disabled, poolProgress }: FooterProps) {
  return (
    <div className="flex flex-col gap-2 px-8 py-8">
      {poolProgress && (
        <div className="text-center text-xs text-[var(--gray-11)]">
          Собираем пул для квиза: {poolProgress.current} / {poolProgress.target}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onUnknown}
          disabled={disabled}
          className={cn(
            'flex flex-1 items-center justify-center rounded-full bg-[var(--red-9)] px-4 py-4 text-sm font-medium text-white',
            'active:bg-[var(--red-10)] disabled:opacity-40',
          )}
        >
          Не знаю
        </button>
        <button
          type="button"
          onClick={onKnown}
          disabled={disabled}
          className={cn(
            'flex flex-1 items-center justify-center rounded-full bg-[var(--green-9)] px-4 py-4 text-sm font-medium text-white',
            'active:bg-[var(--green-10)] disabled:opacity-40',
          )}
        >
          Знаю
        </button>
      </div>
    </div>
  );
}
