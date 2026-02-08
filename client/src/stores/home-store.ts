import { create } from 'zustand';
import type { QuizQuestion, InfiniteAnswerResponse } from '@/types/api';
import { quizNext, quizAnswerInfinite, quizAnswerMatchPairs, ERRORS_COLLECTION_ID } from '@/lib/api';
import { useLeagueStore } from './league-store';
import { useCollectionStore } from './collection-store';

const MAX_RECENT = 20;
const MAX_RECENT_GENERATORS = 10;
const STREAK_KEY = 'wordy:streak';
const QUESTION_KEY = 'wordy:currentQuestion';

function loadStreak(): number {
  const raw = localStorage.getItem(STREAK_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function saveStreak(value: number) {
  localStorage.setItem(STREAK_KEY, String(value));
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
  | 'spelling'      // Spelling (всегда ru-en)
  | 'match-pairs';  // Соединение пар

/** Определяет тип генератора из ответа сервера */
function getGeneratorTypeFromQuestion(question: QuizQuestion): string {
  if (question.type === 'match-pairs') return 'match-pairs';
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
  errorsCleared: boolean;
  doubleXpTimeLimitMs: number | null;
  doubleXpExpired: boolean;

  setCollectionId: (id: number | typeof ERRORS_COLLECTION_ID | undefined) => void;
  setGeneratorMode: (mode: QuestionGeneratorMode) => void;
  fetchNext: () => Promise<void>;
  submitAnswer: (selectedMeaningId: number | null) => Promise<void>;
  submitMatchPairsResults: (results: Array<{ meaningId: number; isCorrect: boolean }>) => Promise<void>;
  skip: () => Promise<void>;
  reset: () => void;
  expireDoubleXp: () => void;
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
  errorsCleared: false,
  doubleXpTimeLimitMs: null,
  doubleXpExpired: false,

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

      // Если ошибки закончились — показываем сообщение, переход на обычный режим через паузу
      if (!res.question && collectionId === ERRORS_COLLECTION_ID) {
        set({ collectionId: undefined, currentQuestion: null, recentMeaningIds: [], recentGenerators: [], errorsCleared: true, isLoading: false });
        return;
      }

      // Трекаем тип генератора для авто-ротации
      const updatedGenerators = res.question
        ? [...recentGenerators, getGeneratorTypeFromQuestion(res.question)].slice(-MAX_RECENT_GENERATORS)
        : recentGenerators;

      saveQuestion(res.question);
      const doubleXpTimeLimitMs = res.question?.doubleXpTimeLimitMs ?? null;
      set({ currentQuestion: res.question, recentGenerators: updatedGenerators, isLoading: false, errorsCleared: false, doubleXpTimeLimitMs, doubleXpExpired: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить вопрос', errorsCleared: false });
    }
  },

  submitAnswer: async (selectedMeaningId) => {
    const { currentQuestion, recentMeaningIds } = get();
    if (!currentQuestion || currentQuestion.type === 'match-pairs') return;

    set({ isLoading: true });
    try {
      const { doubleXpTimeLimitMs, doubleXpExpired } = get();
      const doubleXpClaimed = !!doubleXpTimeLimitMs && !doubleXpExpired;
      const res = await quizAnswerInfinite(currentQuestion.meaningId, selectedMeaningId, get().streak, doubleXpClaimed);

      const updatedRecent = [...recentMeaningIds, currentQuestion.meaningId].slice(-MAX_RECENT);
      const newStreak = res.isCorrect ? get().streak + 1 : 0;
      saveStreak(newStreak);

      // Обновляем LP в реальном времени
      if (res.totalLp !== undefined) {
        useLeagueStore.getState().updateLp(res.totalLp);
      }

      // Инвалидируем кеш коллекции ошибок (incorrectCount мог измениться)
      useCollectionStore.setState({ errorsFetchedAt: null });

      set({
        feedback: { ...res, correctTranslation: currentQuestion.correctTranslation ?? '', meaningId: currentQuestion.meaningId },
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

  submitMatchPairsResults: async (results) => {
    const { currentQuestion, recentMeaningIds } = get();
    if (!currentQuestion || currentQuestion.type !== 'match-pairs') return;

    set({ isLoading: true });
    try {
      const { doubleXpTimeLimitMs: mpDoubleXp, doubleXpExpired: mpExpired } = get();
      const doubleXpClaimed = !!mpDoubleXp && !mpExpired;
      const res = await quizAnswerMatchPairs(results, get().streak, doubleXpClaimed);

      const newMeaningIds = currentQuestion.pairs.map((p) => p.meaningId);
      const updatedRecent = [...recentMeaningIds, ...newMeaningIds].slice(-MAX_RECENT);

      const allCorrect = results.every((r) => r.isCorrect);
      const correctCount = results.filter((r) => r.isCorrect).length;
      const newStreak = allCorrect ? get().streak + correctCount : 0;
      saveStreak(newStreak);

      if (res.totalLp !== undefined) {
        useLeagueStore.getState().updateLp(res.totalLp);
      }

      // Инвалидируем кеш коллекции ошибок (incorrectCount мог измениться)
      useCollectionStore.setState({ errorsFetchedAt: null });

      set({
        feedback: {
          isCorrect: allCorrect,
          correctTranslation: '',
          xpEarned: res.totalXpEarned,
          xpModifier: res.xpModifier,
          lpEarned: res.totalLpEarned,
          lpModifier: res.lpModifier,
          totalXp: res.totalXp,
          totalLp: res.totalLp,
          level: res.level,
          levelUp: res.levelUp,
          gemsEarned: res.gemsEarned,
          doubleXpApplied: res.doubleXpApplied,
          meaningId: currentQuestion.pairs[0]?.meaningId ?? 0,
        },
        recentMeaningIds: updatedRecent,
        isLoading: false,
        streak: newStreak,
      });

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

  expireDoubleXp: () => set({ doubleXpExpired: true }),

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
      doubleXpTimeLimitMs: null,
      doubleXpExpired: false,
    });
  },
}));
