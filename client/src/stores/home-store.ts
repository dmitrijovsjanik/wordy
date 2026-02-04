import { create } from 'zustand';
import type { QuizQuestion, InfiniteAnswerResponse } from '@/types/api';
import { quizNext, quizAnswerInfinite } from '@/lib/api';
import { useLeagueStore } from './league-store';

const MAX_RECENT = 20;
const STREAK_KEY = 'wordy:streak';

function loadStreak(): number {
  const raw = localStorage.getItem(STREAK_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function saveStreak(value: number) {
  localStorage.setItem(STREAK_KEY, String(value));
}

type HomeState = {
  currentQuestion: QuizQuestion | null;
  recentMeaningIds: number[];
  feedback: (InfiniteAnswerResponse & { meaningId: number }) | null;
  isLoading: boolean;
  error: string | null;
  streak: number;
  collectionId: number | undefined;

  setCollectionId: (id: number | undefined) => void;
  fetchNext: () => Promise<void>;
  submitAnswer: (selectedMeaningId: number | null) => Promise<void>;
  skip: () => Promise<void>;
  reset: () => void;
};

export const useHomeStore = create<HomeState>()((set, get) => ({
  currentQuestion: null,
  recentMeaningIds: [],
  feedback: null,
  isLoading: false,
  error: null,
  streak: loadStreak(),
  collectionId: undefined,

  setCollectionId: (id) => set({ collectionId: id, recentMeaningIds: [], currentQuestion: null, feedback: null }),

  fetchNext: async () => {
    // Предотвращаем параллельные запросы (важно для React StrictMode)
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const { recentMeaningIds, collectionId } = get();
      const res = await quizNext(recentMeaningIds, collectionId);
      set({ currentQuestion: res.question, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить вопрос' });
    }
  },

  submitAnswer: async (selectedMeaningId) => {
    const { currentQuestion, recentMeaningIds } = get();
    if (!currentQuestion) return;

    set({ isLoading: true });
    try {
      const res = await quizAnswerInfinite(currentQuestion.meaningId, selectedMeaningId);

      const updatedRecent = [...recentMeaningIds, currentQuestion.meaningId].slice(-MAX_RECENT);
      const newStreak = res.isCorrect ? get().streak + 1 : 0;
      saveStreak(newStreak);

      // Обновляем LP в реальном времени
      if (res.totalLp !== undefined) {
        useLeagueStore.getState().updateLp(res.totalLp);
      }

      set({
        feedback: { ...res, correctTranslation: currentQuestion.correctTranslation, meaningId: currentQuestion.meaningId },
        recentMeaningIds: updatedRecent,
        isLoading: false,
        streak: newStreak,
      });

      // Автопереход к следующему вопросу
      setTimeout(() => {
        set({ feedback: null });
        get().fetchNext();
      }, 1200);
    } catch {
      set({ isLoading: false, error: 'Ошибка при отправке ответа' });
    }
  },

  skip: async () => {
    const { currentQuestion } = get();
    if (!currentQuestion) return;
    // Пропуск = ответ null (неправильно)
    await get().submitAnswer(null);
  },

  reset: () => {
    set({
      currentQuestion: null,
      recentMeaningIds: [],
      feedback: null,
      isLoading: false,
      error: null,
      collectionId: undefined,
    });
  },
}));
