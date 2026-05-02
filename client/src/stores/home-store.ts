import { create } from 'zustand';
import type { QuizQuestion, InfiniteAnswerResponse, GrammarAnswerResponse } from '@/types/api';
import type { AnswerHistoryEntry } from '@/types/game';
import { quizNext, quizAnswerInfinite, quizAnswerMatchPairs, quizAnswerGrammar, refillLives, ERRORS_COLLECTION_ID } from '@/lib/api';
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

/** Проверяет, является ли вопрос грамматическим */
function isGrammarQuestion(q: QuizQuestion): boolean {
  return typeof q.type === 'string' && q.type.startsWith('grammar-');
}

/** Извлекает текст вопроса из QuizQuestion */
function getQuestionText(q: QuizQuestion): string {
  if (q.type === 'match-pairs') return 'Соедини пары';
  if (q.type === 'cloze') return q.sentence;
  if (q.type === 'listening' || q.type === 'dictation') return q.audioWord;
  if (q.type === 'free-recall') return q.prompt;
  if (q.type === 'grammar-article') return q.exercise.sentence;
  if (q.type === 'grammar-tense') return q.exercise.sentence;
  if (q.type === 'grammar-collocation') return q.collocation.blank;
  if (q.type === 'grammar-false-friend') return q.word;
  if (q.type === 'grammar-tense-match') return 'Соедини времена';
  return q.word;
}

/** Извлекает правильный ответ из QuizQuestion */
function getCorrectAnswer(q: QuizQuestion): string {
  if (q.type === 'match-pairs') return '';
  if (q.type === 'grammar-tense-match') return '';
  if (q.type === 'cloze' || q.type === 'listening') return q.correctAnswer;
  if (q.type === 'dictation') return q.correctAnswer;
  if (q.type === 'free-recall') return q.acceptableAnswers[0] ?? '';
  if (q.type === 'spelling') return q.correctSpelling ?? '';
  if (q.type === 'grammar-article') return q.exercise.blanks[0]?.correctAnswer ?? '';
  if (q.type === 'grammar-tense') return q.exercise.correctAnswer;
  if (q.type === 'grammar-collocation') return q.collocation.correctAnswer;
  if (q.type === 'grammar-false-friend') return q.correctAnswer;
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
  // Grammar types
  if (typeof question.type === 'string' && question.type.startsWith('grammar-')) return question.type;
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
  questionIndex: number;
  recentCorrectCount: number;
  recentTotalCount: number;
  answerHistory: AnswerHistoryEntry[];
  lastUserAnswer: string | null;

  // Lives
  lives: number;
  livesRestoredAt: string | null;
  livesExhausted: boolean;

  setCollectionId: (id: number | typeof ERRORS_COLLECTION_ID | undefined) => void;
  setGeneratorMode: (mode: QuestionGeneratorMode) => void;
  fetchNext: () => Promise<void>;
  submitAnswer: (selectedMeaningId: number | null, userAnswer?: string, skip?: boolean) => Promise<void>;
  submitGrammarAnswer: (answer: string, skip?: boolean) => Promise<void>;
  submitMatchPairsResults: (results: Array<{ meaningId: number; isCorrect: boolean }>) => Promise<void>;
  skip: () => Promise<void>;
  reset: () => void;
  expireDoubleXp: () => void;
  setLastUserAnswer: (answer: string | null) => void;
  clearHistory: () => void;
  restoreLives: () => Promise<void>;
  onLivesTimerExpired: () => void;
  updateLives: (lives: number, livesRestoredAt: string | null) => void;
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
  questionIndex: 0,
  recentCorrectCount: 0,
  recentTotalCount: 0,
  answerHistory: loadHistory(),
  lastUserAnswer: null,

  // Lives
  lives: 5,
  livesRestoredAt: null,
  livesExhausted: false,

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
      const { recentMeaningIds, collectionId, generatorMode, recentGenerators, questionIndex } = get();
      const { recentCorrectCount, recentTotalCount } = get();
      const res = await quizNext(recentMeaningIds, collectionId, generatorMode, recentGenerators, recentCorrectCount, recentTotalCount, questionIndex);

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
      const doubleXpTimeLimitMs = (res.question && 'doubleXpTimeLimitMs' in res.question) ? res.question.doubleXpTimeLimitMs ?? null : null;
      set({ currentQuestion: res.question, recentGenerators: updatedGenerators, isLoading: false, errorsCleared: false, doubleXpTimeLimitMs, doubleXpExpired: false });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить вопрос', errorsCleared: false });
    }
  },

  submitAnswer: async (selectedMeaningId, userAnswer?, isSkip?) => {
    const { currentQuestion, recentMeaningIds, lastUserAnswer } = get();
    if (!currentQuestion || currentQuestion.type === 'match-pairs' || isGrammarQuestion(currentQuestion)) return;

    set({ isLoading: true });
    try {
      const { doubleXpTimeLimitMs, doubleXpExpired } = get();
      const doubleXpClaimed = !!doubleXpTimeLimitMs && !doubleXpExpired;
      const res = await quizAnswerInfinite(currentQuestion.meaningId, selectedMeaningId, get().streak, doubleXpClaimed, isSkip);

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

      // Update lives from server response
      const livesUpdate: Partial<HomeState> = {};
      if (res.lives !== undefined) livesUpdate.lives = res.lives;
      if (res.livesRestoredAt !== undefined) livesUpdate.livesRestoredAt = res.livesRestoredAt ?? null;
      if (res.livesExhausted) livesUpdate.livesExhausted = true;

      set({
        feedback: { ...res, meaningId: currentQuestion.meaningId },
        recentMeaningIds: updatedRecent,
        isLoading: false,
        streak: newStreak,
        questionIndex: get().questionIndex + 1,
        recentCorrectCount: resetWindow ? (res.isCorrect ? 1 : 0) : newCorrect,
        recentTotalCount: resetWindow ? 1 : newTotal,
        answerHistory: updatedHistory,
        lastUserAnswer: null,
        doubleXpTimeLimitMs: null,
        ...livesUpdate,
      });

      // Автопереход к следующему вопросу (НЕ если жизни кончились)
      if (!res.livesExhausted) {
        setTimeout(() => {
          set({ feedback: null });
          get().fetchNext();
        }, 1200);
      }
    } catch {
      set({ isLoading: false, error: 'Ошибка при отправке ответа' });
    }
  },

  submitGrammarAnswer: async (answer, isSkip?) => {
    const { currentQuestion } = get();
    if (!currentQuestion || !isGrammarQuestion(currentQuestion)) return;

    set({ isLoading: true });
    try {
      const grammarType = currentQuestion.type;

      // Определяем params для проверки
      let grammarParams: { exerciseIndex?: number; blankIndex?: number; collocationIndex?: number; questionIndex?: number } = {};
      if (grammarType === 'grammar-article') {
        grammarParams = { exerciseIndex: currentQuestion.exerciseIndex };
      } else if (grammarType === 'grammar-tense') {
        grammarParams = { exerciseIndex: currentQuestion.exerciseIndex };
      } else if (grammarType === 'grammar-collocation') {
        grammarParams = { collocationIndex: currentQuestion.collocationIndex };
      } else if (grammarType === 'grammar-false-friend') {
        grammarParams = { questionIndex: currentQuestion.questionIndex };
      }

      const res = await quizAnswerGrammar(grammarType, answer, get().streak, grammarParams, isSkip);
      const newStreak = res.isCorrect ? get().streak + 1 : 0;
      saveStreak(newStreak);

      if (res.totalLp !== undefined) {
        useLeagueStore.getState().updateLp(res.totalLp);
      }

      // Записываем в историю ответов
      const entry: AnswerHistoryEntry = {
        question: getQuestionText(currentQuestion),
        userAnswer: answer,
        correctAnswer: res.correctAnswer || getCorrectAnswer(currentQuestion),
        isCorrect: res.isCorrect,
        type: currentQuestion.type,
        timestamp: Date.now(),
      };
      const updatedHistory = [entry, ...get().answerHistory].slice(0, 200);
      saveHistory(updatedHistory);

      // Update lives from grammar response
      const grammarLivesUpdate: Partial<HomeState> = {};
      if (res.lives !== undefined) grammarLivesUpdate.lives = res.lives;
      if (res.livesRestoredAt !== undefined) grammarLivesUpdate.livesRestoredAt = res.livesRestoredAt ?? null;
      if (res.livesExhausted) grammarLivesUpdate.livesExhausted = true;

      // Формируем feedback в формате InfiniteAnswerResponse
      set({
        feedback: {
          isCorrect: res.isCorrect,
          correctTranslation: res.correctAnswer,
          xpEarned: res.xpEarned,
          xpModifier: res.xpModifier,
          totalXp: res.totalXp,
          totalLp: res.totalLp,
          level: res.level,
          levelUp: res.levelUp,
          lpEarned: res.lpEarned,
          lpModifier: res.lpModifier,
          gemsEarned: res.gemsEarned,
          dailyCorrectCount: res.dailyCorrectCount,
          meaningId: 0, // grammar questions have no meaningId
        },
        isLoading: false,
        streak: newStreak,
        questionIndex: get().questionIndex + 1,
        answerHistory: updatedHistory,
        lastUserAnswer: null,
        ...grammarLivesUpdate,
      });

      if (!res.livesExhausted) {
        setTimeout(() => {
          set({ feedback: null });
          get().fetchNext();
        }, 1200);
      }
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

      // Update lives from match-pairs response
      const mpLivesUpdate: Partial<HomeState> = {};
      if (res.lives !== undefined) mpLivesUpdate.lives = res.lives;
      if (res.livesRestoredAt !== undefined) mpLivesUpdate.livesRestoredAt = res.livesRestoredAt ?? null;
      if (res.livesExhausted) mpLivesUpdate.livesExhausted = true;

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
        questionIndex: get().questionIndex + 1,
        answerHistory: updatedHistory,
        doubleXpTimeLimitMs: null,
        ...mpLivesUpdate,
      });

      if (!res.livesExhausted) {
        setTimeout(() => {
          set({ feedback: null });
          get().fetchNext();
        }, 1200);
      }
    } catch {
      set({ isLoading: false, error: 'Ошибка при отправке ответа' });
    }
  },

  skip: async () => {
    const { currentQuestion } = get();
    if (!currentQuestion) return;
    if (isGrammarQuestion(currentQuestion)) {
      // Пропуск грамматики = пустой ответ (неправильно), без траты жизни
      await get().submitGrammarAnswer('', true);
      return;
    }
    // Пропуск = ответ null (неправильно), без траты жизни
    await get().submitAnswer(null, undefined, true);
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
      questionIndex: 0,
      recentCorrectCount: 0,
      recentTotalCount: 0,
      lastUserAnswer: null,
      livesExhausted: false,
    });
  },

  restoreLives: async () => {
    try {
      const res = await refillLives();
      set({ lives: res.lives, livesRestoredAt: null, livesExhausted: false });
      // Continue quiz
      get().fetchNext();
    } catch {
      // Will be handled by UI (insufficient gems etc.)
    }
  },

  onLivesTimerExpired: () => {
    set({ lives: 5, livesRestoredAt: null, livesExhausted: false });
    get().fetchNext();
  },

  updateLives: (lives, livesRestoredAt) => {
    set({ lives, livesRestoredAt });
  },
}));
