import { create } from 'zustand';
import type { ReviewFeedCard } from '@/types/api';
import { reviewFeedNext, learningSwipe } from '@/lib/api';

const PREFETCH_THRESHOLD = 5;

type ReviewState = {
  cards: ReviewFeedCard[];
  currentIndex: number;
  isLoading: boolean;     // первичная загрузка (UI блокируется)
  isPrefetching: boolean; // фоновая подгрузка (UI не блокируется)
  error: string | null;

  fetchInitial: () => Promise<void>;
  swipe: (action: 'known' | 'unknown' | 'snooze') => Promise<void>;
  reset: () => void;
};

export const useReviewStore = create<ReviewState>()((set, get) => ({
  cards: [],
  currentIndex: 0,
  isLoading: false,
  isPrefetching: false,
  error: null,

  fetchInitial: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null, cards: [], currentIndex: 0 });
    try {
      const res = await reviewFeedNext();
      set({ cards: res.cards, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить карточки' });
    }
  },

  swipe: async (action) => {
    const { cards, currentIndex, isPrefetching } = get();
    const card = cards[currentIndex];
    if (!card) return;

    // Оптимистично сдвигаем индекс — UI не ждёт сети.
    set({ currentIndex: currentIndex + 1 });

    // Фоновый prefetch если близко к концу очереди и не идёт другой prefetch.
    const remaining = cards.length - (currentIndex + 1);
    if (remaining <= PREFETCH_THRESHOLD && !isPrefetching) {
      set({ isPrefetching: true });
      reviewFeedNext()
        .then((res) => {
          // Дописываем новые карточки в хвост, исключая уже свайпнутые
          // (повторы из БД маловероятны, но защитимся через Set).
          const seen = new Set(get().cards.slice(0, get().currentIndex).map(c => c.meaningId));
          const merged = [
            ...get().cards,
            ...res.cards.filter(c => !seen.has(c.meaningId) && !get().cards.some(existing => existing.meaningId === c.meaningId)),
          ];
          set({ cards: merged, isPrefetching: false });
        })
        .catch(() => set({ isPrefetching: false }));
    }

    // Запись свайпа на сервер. Ошибки логируем, но не откатываем UI —
    // пользователь уже двинулся дальше. На N=10 потеря свайпа допустима;
    // если станет проблемой — добавим retry-очередь в localStorage.
    try {
      await learningSwipe({ meaningId: card.meaningId, action });
    } catch (e) {
      console.error('[review] swipe failed:', e);
    }
  },

  reset: () => {
    set({ cards: [], currentIndex: 0, isLoading: false, isPrefetching: false, error: null });
  },
}));
