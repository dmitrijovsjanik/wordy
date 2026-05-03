import { create } from 'zustand';
import type { ReviewFeedCard, ReviewFeedWord } from '@/types/api';
import { reviewFeedNext, reviewFeedWords, learningSwipe, learningUndoSwipe } from '@/lib/api';

const PREFETCH_THRESHOLD = 5;
const MODE_KEY = 'wordy:reviewMode';

type Action = 'known' | 'unknown' | 'snooze';

type HistoryEntry =
  | { mode: 'A'; prevWordIndex: number; prevMeaningIndex: number; action: Action; meaningIds: number[] }
  | { mode: 'B'; prevCardIndex: number; action: Action; meaningIds: number[] };

type ReviewState = {
  mode: 'A' | 'B';

  // Режим A: слова со стопками значений.
  words: ReviewFeedWord[];
  wordIndex: number;
  meaningIndex: number;

  // Режим B: плоский поток.
  cards: ReviewFeedCard[];
  cardIndex: number;

  // Общее.
  isLoading: boolean;
  isPrefetching: boolean;
  error: string | null;
  history: HistoryEntry[];

  /** Направление последнего перехода между СЛОВАМИ. Используется для
   *  вертикальной карусели: forward = вверх (новое слово снизу),
   *  backward = вниз (предыдущее слово сверху). */
  wordTransitionDirection: 'forward' | 'backward';

  setMode: (m: 'A' | 'B') => void;
  fetchInitial: () => Promise<void>;
  swipe: (action: Action) => Promise<void>;
  undo: () => Promise<void>;
  reset: () => void;
};

function loadMode(): 'A' | 'B' {
  const v = localStorage.getItem(MODE_KEY);
  return v === 'B' ? 'B' : 'A';
}

function saveMode(m: 'A' | 'B') {
  localStorage.setItem(MODE_KEY, m);
}

export const useReviewStore = create<ReviewState>()((set, get) => ({
  mode: loadMode(),
  words: [],
  wordIndex: 0,
  meaningIndex: 0,
  cards: [],
  cardIndex: 0,
  isLoading: false,
  isPrefetching: false,
  error: null,
  history: [],
  wordTransitionDirection: 'forward',

  setMode: (m) => {
    saveMode(m);
    // Не сбрасываем words/cards — данные другого режима пусть остаются для
    // мгновенного возврата. Только обнуляем history/error — они привязаны
    // к выполненным действиям, между режимами не имеют смысла.
    set({ mode: m, history: [], error: null });
    // fetchInitial сделает сам решение: если данные уже есть — no-op.
    get().fetchInitial();
  },

  fetchInitial: async () => {
    if (get().isLoading) return;
    const cur = get();
    // Если данные текущего режима уже есть — не делаем повторный запрос.
    // Это позволяет переключаться A↔B без skeleton-промежутка.
    if (cur.mode === 'A' && cur.words.length > 0 && cur.wordIndex < cur.words.length) return;
    if (cur.mode === 'B' && cur.cards.length > 0 && cur.cardIndex < cur.cards.length) return;

    set({ isLoading: true, error: null });
    try {
      if (get().mode === 'A') {
        const res = await reviewFeedWords({ limit: 15 });
        set({ words: res.words, wordIndex: 0, meaningIndex: 0, isLoading: false });
      } else {
        const res = await reviewFeedNext({ limit: 30 });
        set({ cards: res.cards, cardIndex: 0, isLoading: false });
      }
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить' });
    }
  },

  swipe: async (action) => {
    const state = get();
    if (state.mode === 'A') {
      const word = state.words[state.wordIndex];
      if (!word) return;
      const meaning = word.meanings[state.meaningIndex];
      if (!meaning) return;

      if (action === 'snooze') {
        // Skip всей стопки: snooze всех ещё не отвеченных значений начиная с текущего.
        const remaining = word.meanings.slice(state.meaningIndex).map(m => m.meaningId);
        set({
          history: [...state.history, {
            mode: 'A',
            prevWordIndex: state.wordIndex,
            prevMeaningIndex: state.meaningIndex,
            action,
            meaningIds: remaining,
          }],
          wordIndex: state.wordIndex + 1,
          meaningIndex: 0,
          wordTransitionDirection: 'forward',
        });
        // Prefetch если близко к концу.
        prefetchIfNeeded();
        // Сетевой запрос — fire-and-forget.
        learningSwipe({ meaningIds: remaining, action: 'snooze' }).catch((e) => console.error('[review] swipe failed:', e));
        return;
      }

      // known / unknown — решение по одному значению.
      const nextMeaningIndex = state.meaningIndex + 1;
      const isLastMeaning = nextMeaningIndex >= word.meanings.length;
      set({
        history: [...state.history, {
          mode: 'A',
          prevWordIndex: state.wordIndex,
          prevMeaningIndex: state.meaningIndex,
          action,
          meaningIds: [meaning.meaningId],
        }],
        wordIndex: isLastMeaning ? state.wordIndex + 1 : state.wordIndex,
        meaningIndex: isLastMeaning ? 0 : nextMeaningIndex,
        // Направление меняется только при смене слова. Внутри стопки оставляем как было.
        wordTransitionDirection: isLastMeaning ? 'forward' : state.wordTransitionDirection,
      });
      prefetchIfNeeded();
      learningSwipe({ meaningId: meaning.meaningId, action }).catch((e) => console.error('[review] swipe failed:', e));
      return;
    }

    // Режим B (плоский).
    const card = state.cards[state.cardIndex];
    if (!card) return;
    set({
      history: [...state.history, {
        mode: 'B',
        prevCardIndex: state.cardIndex,
        action,
        meaningIds: [card.meaningId],
      }],
      cardIndex: state.cardIndex + 1,
      wordTransitionDirection: 'forward',
    });
    prefetchIfNeeded();
    learningSwipe({ meaningId: card.meaningId, action }).catch((e) => console.error('[review] swipe failed:', e));
  },

  undo: async () => {
    const state = get();
    const last = state.history[state.history.length - 1];
    if (!last) return;
    // Возвращаем индексы сразу — UI отзывчив.
    if (last.mode === 'A') {
      const isCrossWord = last.prevWordIndex !== state.wordIndex;
      set({
        wordIndex: last.prevWordIndex,
        meaningIndex: last.prevMeaningIndex,
        history: state.history.slice(0, -1),
        wordTransitionDirection: isCrossWord ? 'backward' : state.wordTransitionDirection,
      });
    } else {
      set({
        cardIndex: last.prevCardIndex,
        history: state.history.slice(0, -1),
        wordTransitionDirection: 'backward',
      });
    }
    // Снимаем серверные записи (паралельно, не ждём).
    // Прокидываем original_action — нужен для аналитики (event review_undo).
    // Передаём meaningId — сервер сам резолвит wordId через JOIN и удалит
    // word-level запись (новая архитектура).
    for (const id of last.meaningIds) {
      learningUndoSwipe({ meaningId: id }, last.action).catch((e) => console.error('[review] undo failed:', e));
    }
  },

  reset: () => {
    set({
      words: [],
      wordIndex: 0,
      meaningIndex: 0,
      cards: [],
      cardIndex: 0,
      history: [],
      isLoading: false,
      isPrefetching: false,
      error: null,
    });
  },
}));

/** Внутренний helper для бесконечного prefetch'а. Не часть store-API. */
function prefetchIfNeeded() {
  const state = useReviewStore.getState();
  if (state.isPrefetching) return;

  if (state.mode === 'A') {
    const remaining = state.words.length - state.wordIndex;
    if (remaining > PREFETCH_THRESHOLD) return;
    useReviewStore.setState({ isPrefetching: true });
    reviewFeedWords({ limit: 15, excludeWordIds: state.words.map(w => w.wordId) })
      .then((res) => {
        const seen = new Set(useReviewStore.getState().words.map(w => w.wordId));
        const merged = [
          ...useReviewStore.getState().words,
          ...res.words.filter(w => !seen.has(w.wordId)),
        ];
        useReviewStore.setState({ words: merged, isPrefetching: false });
      })
      .catch(() => useReviewStore.setState({ isPrefetching: false }));
    return;
  }

  // Mode B prefetch.
  const remaining = state.cards.length - state.cardIndex;
  if (remaining > PREFETCH_THRESHOLD) return;
  useReviewStore.setState({ isPrefetching: true });
  reviewFeedNext({ limit: 30 })
    .then((res) => {
      const seen = new Set(useReviewStore.getState().cards.map(c => c.meaningId));
      const merged = [
        ...useReviewStore.getState().cards,
        ...res.cards.filter(c => !seen.has(c.meaningId)),
      ];
      useReviewStore.setState({ cards: merged, isPrefetching: false });
    })
    .catch(() => useReviewStore.setState({ isPrefetching: false }));
}
