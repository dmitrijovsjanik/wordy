import { create } from 'zustand';
import type { QuizQuestion, InfiniteAnswerResponse } from '@/types/api';
import { quizNext, quizAnswerInfinite, ERRORS_COLLECTION_ID } from '@/lib/api';
import { useLeagueStore } from './league-store';

const MAX_RECENT = 20;
const MAX_RECENT_GENERATORS = 10;
const STREAK_KEY = 'wordy:streak';
const MILESTONES_KEY = 'wordy:streak_milestones';
const STREAK_MILESTONES = [10, 20, 30];
const QUESTION_KEY = 'wordy:currentQuestion';

function loadStreak(): number {
  const raw = localStorage.getItem(STREAK_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function saveStreak(value: number) {
  localStorage.setItem(STREAK_KEY, String(value));
  if (STREAK_MILESTONES.includes(value)) {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(MILESTONES_KEY);
    let data: { date: string; done: number[] } = { date: today, done: [] };
    if (raw) {
      try { data = JSON.parse(raw); } catch { /* ignore */ }
    }
    if (data.date !== today) data = { date: today, done: [] };
    if (!data.done.includes(value)) {
      data.done.push(value);
      localStorage.setItem(MILESTONES_KEY, JSON.stringify(data));
    }
  }
}

function loadQuestion(): QuizQuestion | null {
  try {
    const raw = sessionStorage.getItem(QUESTION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as QuizQuestion;
  } catch {
    return null;
  }
}

function saveQuestion(question: QuizQuestion | null) {
  if (question) {
    sessionStorage.setItem(QUESTION_KEY, JSON.stringify(question));
  } else {
    sessionStorage.removeItem(QUESTION_KEY);
  }
}

export type QuestionGeneratorMode =
  | 'auto'          // Случайное направление, multiple-choice
  | 'en-ru'         // EN → RU, multiple-choice
  | 'ru-en'         // RU → EN, multiple-choice
  | 'spelling';     // Spelling (всегда ru-en)

/** Определяет тип генератора из ответа сервера */
function getGeneratorTypeFromQuestion(question: QuizQuestion): string {
  if (question.type === 'spelling') return 'spelling';
  return question.direction; // 'en-ru' или 'ru-en'
}

type HomeState = {
  currentQuestion: QuizQuestion | null;
  recentMeaningIds: number[];
  recentGenerators: string[];
  feedback: (InfiniteAnswerResponse & { meaningId: number }) | null;
  isLoading: boolean;
  error: string | null;
  streak: number;
  collectionId: number | typeof ERRORS_COLLECTION_ID | undefined;
  generatorMode: QuestionGeneratorMode;

  setCollectionId: (id: number | typeof ERRORS_COLLECTION_ID | undefined) => void;
  setGeneratorMode: (mode: QuestionGeneratorMode) => void;
  fetchNext: () => Promise<void>;
  submitAnswer: (selectedMeaningId: number | null) => Promise<void>;
  skip: () => Promise<void>;
  reset: () => void;
};

export const useHomeStore = create<HomeState>()((set, get) => ({
  currentQuestion: loadQuestion(),
  recentMeaningIds: [],
  recentGenerators: [],
  feedback: null,
  isLoading: false,
  error: null,
  streak: loadStreak(),
  collectionId: undefined,
  generatorMode: 'auto',

  setCollectionId: (id) => {
    saveQuestion(null);
    set({ collectionId: id, recentMeaningIds: [], recentGenerators: [], currentQuestion: null, feedback: null });
  },
  setGeneratorMode: (mode) => set({ generatorMode: mode }),

  fetchNext: async () => {
    // Предотвращаем параллельные запросы (важно для React StrictMode)
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const { recentMeaningIds, collectionId, generatorMode, recentGenerators } = get();
      const res = await quizNext(recentMeaningIds, collectionId, generatorMode, recentGenerators);

      // Трекаем тип генератора для авто-ротации
      const updatedGenerators = res.question
        ? [...recentGenerators, getGeneratorTypeFromQuestion(res.question)].slice(-MAX_RECENT_GENERATORS)
        : recentGenerators;

      saveQuestion(res.question);
      set({ currentQuestion: res.question, recentGenerators: updatedGenerators, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить вопрос' });
    }
  },

  submitAnswer: async (selectedMeaningId) => {
    const { currentQuestion, recentMeaningIds } = get();
    if (!currentQuestion) return;

    set({ isLoading: true });
    try {
      const res = await quizAnswerInfinite(currentQuestion.meaningId, selectedMeaningId, get().streak);

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
    saveQuestion(null);
    set({
      currentQuestion: null,
      recentMeaningIds: [],
      recentGenerators: [],
      feedback: null,
      isLoading: false,
      error: null,
      collectionId: undefined,
    });
  },
}));
