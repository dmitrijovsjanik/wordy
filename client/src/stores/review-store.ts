import { create } from 'zustand';
import type { ReviewFeedWord } from '@/types/api';
import { reviewFeedNext, learningSwipe, learningUndoSwipe } from '@/lib/api';

const PREFETCH_THRESHOLD = 5;
const BATCH_SIZE = 15;

type Action = 'known' | 'unknown' | 'snooze';

type HistoryEntry = {
  prevWordIndex: number;
  action: Action;
  wordId: number;
};

type ReviewState = {
  words: ReviewFeedWord[];
  wordIndex: number;
  isLoading: boolean;
  isPrefetching: boolean;
  error: string | null;
  history: HistoryEntry[];

  /** forward = новое слово появляется снизу; backward = после undo сверху. */
  wordTransitionDirection: 'forward' | 'backward';

  fetchInitial: () => Promise<void>;
  swipe: (action: Action) => Promise<void>;
  undo: () => Promise<void>;
  reset: () => void;
};

// Удаляем legacy localStorage-ключ при инициализации модуля. У Дмитрия один
// активный пользователь — потеря старого review-режима безболезненна.
try { localStorage.removeItem('wordy:reviewMode'); } catch { /* SSR-safe noop */ }

export const useReviewStore = create<ReviewState>()((set, get) => ({
  words: [],
  wordIndex: 0,
  isLoading: false,
  isPrefetching: false,
  error: null,
  history: [],
  wordTransitionDirection: 'forward',

  fetchInitial: async () => {
    if (get().isLoading) return;
    const cur = get();
    if (cur.words.length > 0 && cur.wordIndex < cur.words.length) return;

    set({ isLoading: true, error: null });
    try {
      const res = await reviewFeedNext({ limit: BATCH_SIZE });
      set({ words: res.words, wordIndex: 0, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить' });
    }
  },

  swipe: async (action) => {
    const state = get();
    const word = state.words[state.wordIndex];
    if (!word) return;

    set({
      history: [...state.history, {
        prevWordIndex: state.wordIndex,
        action,
        wordId: word.wordId,
      }],
      wordIndex: state.wordIndex + 1,
      wordTransitionDirection: 'forward',
    });
    prefetchIfNeeded();
    // Свайп = решение по слову целиком (state на word, не на meaning).
    learningSwipe({ wordId: word.wordId, action })
      .catch((e) => console.error('[review] swipe failed:', e));
  },

  undo: async () => {
    const state = get();
    const last = state.history[state.history.length - 1];
    if (!last) return;
    set({
      wordIndex: last.prevWordIndex,
      history: state.history.slice(0, -1),
      wordTransitionDirection: 'backward',
    });
    learningUndoSwipe({ wordId: last.wordId }, last.action)
      .catch((e) => console.error('[review] undo failed:', e));
  },

  reset: () => {
    set({
      words: [],
      wordIndex: 0,
      history: [],
      isLoading: false,
      isPrefetching: false,
      error: null,
    });
  },
}));

/** Фоновая подгрузка следующей пачки при приближении к концу. */
function prefetchIfNeeded() {
  const state = useReviewStore.getState();
  if (state.isPrefetching) return;
  const remaining = state.words.length - state.wordIndex;
  if (remaining > PREFETCH_THRESHOLD) return;

  useReviewStore.setState({ isPrefetching: true });
  reviewFeedNext({ limit: BATCH_SIZE, excludeWordIds: state.words.map((w) => w.wordId) })
    .then((res) => {
      const seen = new Set(useReviewStore.getState().words.map((w) => w.wordId));
      const merged = [
        ...useReviewStore.getState().words,
        ...res.words.filter((w) => !seen.has(w.wordId)),
      ];
      useReviewStore.setState({ words: merged, isPrefetching: false });
    })
    .catch(() => useReviewStore.setState({ isPrefetching: false }));
}
