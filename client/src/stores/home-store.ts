import { create } from 'zustand';
import type { QuizQuestion, InfiniteAnswerResponse } from '@/types/api';
import { quizNext, quizAnswerInfinite } from '@/lib/api';

const MAX_RECENT = 20;

type HomeState = {
  currentQuestion: QuizQuestion | null;
  recentMeaningIds: number[];
  feedback: (InfiniteAnswerResponse & { meaningId: number }) | null;
  isLoading: boolean;
  error: string | null;

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

  fetchNext: async () => {
    set({ isLoading: true, error: null });
    try {
      const { recentMeaningIds } = get();
      const res = await quizNext(recentMeaningIds);
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

      set({
        feedback: { ...res, meaningId: currentQuestion.meaningId },
        recentMeaningIds: updatedRecent,
        isLoading: false,
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
    });
  },
}));
