import { create } from 'zustand';
import type { QuizQuestion, InfiniteAnswerResponse } from '@/types/api';
import type { AnswerHistoryEntry } from '@/types/game';
import { quizNext, quizAnswerInfinite, quizAnswerMatchPairs, ERRORS_COLLECTION_ID } from '@/lib/api';
import { useLeagueStore } from './league-store';
import { useCollectionStore } from './collection-store';

const MAX_RECENT = 20;
const MAX_RECENT_GENERATORS = 10;
const STREAK_KEY = 'wordy:streak';
const QUESTION_KEY = 'wordy:currentQuestion';
const HISTORY_KEY = 'wordy:answerHistory';
const HISTORY_DATE_KEY = 'wordy:answerHistoryDate';

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

/** Текущий "день" по МСК (граница 04:00 UTC+3 = 01:00 UTC) */
function getMskDay(): string {
  const now = new Date();
  // МСК = UTC+3, граница дня = 04:00 МСК = 01:00 UTC
  const mskMs = now.getTime() + 3 * 60 * 60 * 1000;
  const mskDate = new Date(mskMs);
  // Вычитаем 4 часа — «день» начинается в 04:00
  const adjusted = new Date(mskDate.getTime() - 4 * 60 * 60 * 1000);
  return `${adjusted.getUTCFullYear()}-${String(adjusted.getUTCMonth() + 1).padStart(2, '0')}-${String(adjusted.getUTCDate()).padStart(2, '0')}`;
}

function loadHistory(): AnswerHistoryEntry[] {
  try {
    const savedDate = localStorage.getItem(HISTORY_DATE_KEY);
    const currentDay = getMskDay();
    if (savedDate !== currentDay) {
      localStorage.removeItem(HISTORY_KEY);
      localStorage.setItem(HISTORY_DATE_KEY, currentDay);
      return [];
    }
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AnswerHistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: AnswerHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  localStorage.setItem(HISTORY_DATE_KEY, getMskDay());
}

/** Извлекает текст вопроса из QuizQuestion */
function getQuestionText(q: QuizQuestion): string {
  if (q.type === 'match-pairs') return 'Соедини пары';
  if (q.type === 'cloze') return q.sentence;
  if (q.type === 'listening' || q.type === 'dictation') return q.audioWord;
  if (q.type === 'free-recall') return q.prompt;
  return q.word;
}

/** Извлекает правильный ответ из QuizQuestion */
function getCorrectAnswer(q: QuizQuestion): string {
  if (q.type === 'match-pairs') return '';
  if (q.type === 'cloze' || q.type === 'listening') return q.correctAnswer;
  if (q.type === 'dictation') return q.correctAnswer;
  if (q.type === 'free-recall') return q.acceptableAnswers[0] ?? '';
  if (q.type === 'spelling') return q.correctSpelling ?? '';
  return q.correctTranslation ?? '';
}

export type QuestionGeneratorMode =
  | 'auto'          // Случайное направление, multiple-choice
  | 'en-ru'         // EN → RU, multiple-choice
  | 'ru-en'         // RU → EN, multiple-choice
  | 'spelling'      // Spelling (всегда ru-en)
  | 'match-pairs'   // Соединение пар
  | 'cloze'         // Заполни пропуск
  | 'listening'     // Слушай → выбери перевод
  | 'dictation'     // Слушай → напиши
  | 'free-recall';  // Напиши перевод

/** Определяет тип генератора из ответа сервера */
function getGeneratorTypeFromQuestion(question: QuizQuestion): string {
  if (question.type === 'match-pairs') return 'match-pairs';
  if (question.type === 'spelling') return 'spelling';
  if (question.type === 'cloze') return 'cloze';
  if (question.type === 'listening') return 'listening';
  if (question.type === 'dictation') return 'dictation';
  if (question.type === 'free-recall') return 'free-recall';
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
  recentCorrectCount: number;
  recentTotalCount: number;
  answerHistory: AnswerHistoryEntry[];
  lastUserAnswer: string | null;

  setCollectionId: (id: number | typeof ERRORS_COLLECTION_ID | undefined) => void;
  setGeneratorMode: (mode: QuestionGeneratorMode) => void;
  fetchNext: () => Promise<void>;
  submitAnswer: (selectedMeaningId: number | null, userAnswer?: string) => Promise<void>;
  submitMatchPairsResults: (results: Array<{ meaningId: number; isCorrect: boolean }>) => Promise<void>;
  skip: () => Promise<void>;
  reset: () => void;
  expireDoubleXp: () => void;
  setLastUserAnswer: (answer: string | null) => void;
  clearHistory: () => void;
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
  recentCorrectCount: 0,
  recentTotalCount: 0,
  answerHistory: loadHistory(),
  lastUserAnswer: null,

  setLastUserAnswer: (answer) => set({ lastUserAnswer: answer }),
  clearHistory: () => {
    saveHistory([]);
    set({ answerHistory: [] });
  },

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
      const { recentCorrectCount, recentTotalCount } = get();
      const res = await quizNext(recentMeaningIds, collectionId, generatorMode, recentGenerators, recentCorrectCount, recentTotalCount);

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

  submitAnswer: async (selectedMeaningId, userAnswer?) => {
    const { currentQuestion, recentMeaningIds, lastUserAnswer } = get();
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

      // Track adaptive difficulty stats (last 10 answers)
      const prevCorrect = get().recentCorrectCount;
      const prevTotal = get().recentTotalCount;
      const newCorrect = res.isCorrect ? prevCorrect + 1 : prevCorrect;
      const newTotal = prevTotal + 1;
      // Reset after 10 answers to keep the window fresh
      const resetWindow = newTotal >= 10;

      // Записываем в историю ответов
      const answerText = userAnswer ?? lastUserAnswer ?? (res.isCorrect ? getCorrectAnswer(currentQuestion) : '—');
      const entry: AnswerHistoryEntry = {
        question: getQuestionText(currentQuestion),
        userAnswer: answerText,
        correctAnswer: res.correctTranslation || getCorrectAnswer(currentQuestion),
        isCorrect: res.isCorrect,
        type: currentQuestion.type ?? 'multiple-choice',
        timestamp: Date.now(),
      };
      const updatedHistory = [entry, ...get().answerHistory].slice(0, 200);
      saveHistory(updatedHistory);

      set({
        feedback: { ...res, meaningId: currentQuestion.meaningId },
        recentMeaningIds: updatedRecent,
        isLoading: false,
        streak: newStreak,
        recentCorrectCount: resetWindow ? (res.isCorrect ? 1 : 0) : newCorrect,
        recentTotalCount: resetWindow ? 1 : newTotal,
        answerHistory: updatedHistory,
        lastUserAnswer: null,
        doubleXpTimeLimitMs: null, // Сбрасываем сразу, чтобы x2 фон не мелькал при смене вопроса
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

      // Записываем историю ответов для каждой пары
      const pairEntries: AnswerHistoryEntry[] = currentQuestion.pairs.map((pair) => {
        const pairResult = results.find((r) => r.meaningId === pair.meaningId);
        return {
          question: pair.word,
          userAnswer: pair.translation,
          correctAnswer: pair.translation,
          isCorrect: pairResult?.isCorrect ?? false,
          type: 'match-pairs',
          timestamp: Date.now(),
        };
      });
      const updatedHistory = [...pairEntries, ...get().answerHistory].slice(0, 200);
      saveHistory(updatedHistory);

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
        answerHistory: updatedHistory,
        doubleXpTimeLimitMs: null,
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
      recentCorrectCount: 0,
      recentTotalCount: 0,
      lastUserAnswer: null,
    });
  },
}));
