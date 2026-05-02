import { create } from 'zustand';
import type { QuizQuestion, QuizQuestionBase, QuizResultResponse } from '@/types/api';
import type { GameMode, AnswerFeedback, RewardDisplay } from '@/types/game';
import { quizStart, quizAnswer, quizFinish, quizNext, quizAnswerInfinite, quizAnswerGrammar } from '@/lib/api';
import { useLeagueStore } from './league-store';

const MAX_RECENT = 20;
const MAX_RECENT_GENERATORS = 10;
const STREAK_KEY = 'wordy:streak';
const FEEDBACK_DELAY = 1200;

/** Определяет тип генератора из ответа сервера */
function getGeneratorTypeFromQuestion(question: QuizQuestion): string {
  if (question.type === 'match-pairs') return 'match-pairs';
  if (question.type === 'spelling') return 'spelling';
  if (question.type === 'cloze') return 'cloze';
  if (question.type === 'listening') return 'listening';
  if (question.type === 'dictation') return 'dictation';
  if (question.type === 'free-recall') return 'free-recall';
  // Grammar types
  if (question.type?.startsWith('grammar-')) return question.type;
  return (question as { direction?: string }).direction ?? 'en-ru';
}

/** Проверяет, является ли вопрос грамматическим */
function isGrammarQuestion(question: QuizQuestion): boolean {
  return typeof question.type === 'string' && question.type.startsWith('grammar-');
}

function loadStreak(): number {
  const raw = localStorage.getItem(STREAK_KEY);
  return raw ? Number(raw) || 0 : 0;
}

function saveStreak(value: number) {
  localStorage.setItem(STREAK_KEY, String(value));
}

type AnswerRecord = {
  meaningId: number;
  selectedMeaningId: number | null;
  isCorrect: boolean;
};

type UnifiedGameState = {
  // Режим игры
  mode: GameMode;

  // Общее состояние
  currentQuestion: QuizQuestion | null;
  isLoading: boolean;
  error: string | null;
  selectedAnswer: string | null;

  // Feedback после ответа
  feedback: AnswerFeedback | null;

  // Streak (для infinite mode, сохраняется в localStorage)
  streak: number;

  // Session mode
  sessionId: number | null;
  questionIndex: number;
  answers: AnswerRecord[];
  result: QuizResultResponse | null;
  maxQuestions: number;

  // Infinite mode
  recentMeaningIds: number[];
  recentGenerators: string[];
  collectionId: number | undefined;

  // Actions
  startGame: (mode: GameMode, options?: { collectionId?: number; maxQuestions?: number }) => Promise<void>;
  submitAnswer: (answer: string) => Promise<void>;
  skip: () => Promise<void>;
  reset: () => void;
  setCollectionId: (id: number | undefined) => void;
};

export const useUnifiedGameStore = create<UnifiedGameState>()((set, get) => ({
  // Defaults
  mode: 'infinite',
  currentQuestion: null,
  isLoading: false,
  error: null,
  selectedAnswer: null,
  feedback: null,
  streak: loadStreak(),

  // Session
  sessionId: null,
  questionIndex: 0,
  answers: [],
  result: null,
  maxQuestions: 10,

  // Infinite
  recentMeaningIds: [],
  recentGenerators: [],
  collectionId: undefined,

  startGame: async (mode, options = {}) => {
    set({
      mode,
      isLoading: true,
      error: null,
      currentQuestion: null,
      feedback: null,
      selectedAnswer: null,
      answers: [],
      result: null,
      questionIndex: 0,
      recentMeaningIds: [],
      recentGenerators: [],
      collectionId: options.collectionId,
      maxQuestions: options.maxQuestions ?? 10,
    });

    try {
      if (mode === 'session') {
        const res = await quizStart();
        set({ sessionId: res.sessionId, currentQuestion: res.question, isLoading: false });
      } else if (mode === 'infinite') {
        const res = await quizNext([], options.collectionId);
        const generators = res.question ? [getGeneratorTypeFromQuestion(res.question)] : [];
        set({ currentQuestion: res.question, recentGenerators: generators, isLoading: false });
      }
    } catch {
      set({ isLoading: false, error: 'Не удалось начать игру' });
    }
  },

  submitAnswer: async (answer) => {
    const { mode, currentQuestion, sessionId, answers, questionIndex, recentMeaningIds } = get();
    if (!currentQuestion) return;

    set({ isLoading: true, selectedAnswer: answer });

    // Определяем selectedMeaningId по выбранному ответу
    const q = currentQuestion as QuizQuestionBase;
    const isCorrectGuess = answer === q.correctTranslation;
    const selectedMeaningId = isCorrectGuess ? q.meaningId : null;

    try {
      if (mode === 'session') {
        if (!sessionId) return;

        const answerTimeMs = 0; // TODO: трекать время
        const res = await quizAnswer({
          sessionId,
          meaningId: q.meaningId,
          selectedMeaningId,
          answerTimeMs,
        });

        const newAnswer: AnswerRecord = {
          meaningId: q.meaningId,
          selectedMeaningId,
          isCorrect: res.isCorrect,
        };

        set({
          answers: [...answers, newAnswer],
          feedback: {
            isCorrect: res.isCorrect,
            correctAnswer: q.correctTranslation ?? '',
          },
          isLoading: false,
        });

        if (res.isFinished) {
          const result = await quizFinish(sessionId);
          set({ result, currentQuestion: null });
        } else {
          setTimeout(() => {
            set({
              currentQuestion: res.nextQuestion,
              questionIndex: questionIndex + 1,
              feedback: null,
              selectedAnswer: null,
            });
          }, FEEDBACK_DELAY);
        }
      } else if (mode === 'infinite') {
        // ─── Grammar question path ────────────────────────────────────
        if (isGrammarQuestion(currentQuestion)) {
          const grammarQ = currentQuestion as { type: string; exerciseIndex?: number; collocationIndex?: number; questionIndex?: number; exercise?: { correctAnswer?: string }; collocation?: { correctAnswer?: string }; correctAnswer?: string };
          const grammarType = grammarQ.type;

          // Определяем correctAnswer и params для проверки
          let grammarParams: { exerciseIndex?: number; blankIndex?: number; collocationIndex?: number; questionIndex?: number } = {};
          let correctAnswer = '';

          if (grammarType === 'grammar-article') {
            grammarParams = { exerciseIndex: grammarQ.exerciseIndex };
            // Для артиклей correctAnswer берётся из blanks[0]
            const ex = (currentQuestion as { exercise: { blanks: Array<{ correctAnswer: string }> } }).exercise;
            correctAnswer = ex.blanks[0]?.correctAnswer ?? '';
          } else if (grammarType === 'grammar-tense') {
            grammarParams = { exerciseIndex: grammarQ.exerciseIndex };
            correctAnswer = (currentQuestion as { exercise: { correctAnswer: string } }).exercise.correctAnswer;
          } else if (grammarType === 'grammar-collocation') {
            grammarParams = { collocationIndex: grammarQ.collocationIndex };
            correctAnswer = (currentQuestion as { collocation: { correctAnswer: string } }).collocation.correctAnswer;
          } else if (grammarType === 'grammar-false-friend') {
            grammarParams = { questionIndex: grammarQ.questionIndex };
            correctAnswer = (currentQuestion as { correctAnswer: string }).correctAnswer;
          }

          const res = await quizAnswerGrammar(grammarType, answer, get().streak, grammarParams);
          const newStreak = res.isCorrect ? get().streak + 1 : 0;
          saveStreak(newStreak);

          if (res.totalLp !== undefined) {
            useLeagueStore.getState().updateLp(res.totalLp);
          }

          set({
            feedback: {
              isCorrect: res.isCorrect,
              correctAnswer: correctAnswer,
              xpEarned: res.xpEarned,
              xpModifier: res.xpModifier,
              lpEarned: res.lpEarned,
              lpModifier: res.lpModifier,
              totalXp: res.totalXp,
              totalLp: res.totalLp,
              level: res.level,
              levelUp: res.levelUp,
            },
            isLoading: false,
            streak: newStreak,
            questionIndex: questionIndex + 1,
          });

          // Автопереход к следующему вопросу
          setTimeout(async () => {
            set({ feedback: null, selectedAnswer: null });
            const state = get();
            const nextRes = await quizNext(
              state.recentMeaningIds,
              state.collectionId,
              undefined,
              state.recentGenerators,
              undefined,
              undefined,
              state.questionIndex,
            );
            const updatedGenerators = nextRes.question
              ? [...state.recentGenerators, getGeneratorTypeFromQuestion(nextRes.question)].slice(-MAX_RECENT_GENERATORS)
              : state.recentGenerators;
            set({ currentQuestion: nextRes.question, recentGenerators: updatedGenerators });
          }, FEEDBACK_DELAY);

          return;
        }

        // ─── Vocabulary question path ─────────────────────────────────
        const res = await quizAnswerInfinite(q.meaningId, selectedMeaningId, get().streak);

        const updatedRecent = [...recentMeaningIds, q.meaningId].slice(-MAX_RECENT);
        const newStreak = res.isCorrect ? get().streak + 1 : 0;
        saveStreak(newStreak);

        // Обновляем LP в реальном времени
        if (res.totalLp !== undefined) {
          useLeagueStore.getState().updateLp(res.totalLp);
        }

        set({
          feedback: {
            isCorrect: res.isCorrect,
            correctAnswer: q.correctTranslation ?? '',
            xpEarned: res.xpEarned,
            xpModifier: res.xpModifier,
            lpEarned: res.lpEarned,
            lpModifier: res.lpModifier,
            totalXp: res.totalXp,
            totalLp: res.totalLp,
            level: res.level,
            levelUp: res.levelUp,
            examples: res.examples,
            mnemonic: res.mnemonic,
          },
          recentMeaningIds: updatedRecent,
          isLoading: false,
          streak: newStreak,
          questionIndex: questionIndex + 1,
        });

        // Автопереход к следующему вопросу
        setTimeout(async () => {
          set({ feedback: null, selectedAnswer: null });
          const state = get();
          const nextRes = await quizNext(
            state.recentMeaningIds,
            state.collectionId,
            undefined,
            state.recentGenerators,
            undefined,
            undefined,
            state.questionIndex,
          );
          const updatedGenerators = nextRes.question
            ? [...state.recentGenerators, getGeneratorTypeFromQuestion(nextRes.question)].slice(-MAX_RECENT_GENERATORS)
            : state.recentGenerators;
          set({ currentQuestion: nextRes.question, recentGenerators: updatedGenerators });
        }, FEEDBACK_DELAY);
      }
    } catch {
      set({ isLoading: false, error: 'Ошибка при отправке ответа' });
    }
  },

  skip: async () => {
    const { currentQuestion } = get();
    if (!currentQuestion) return;
    // Пропуск = неправильный ответ с пустым selectedAnswer
    // Передаём пустую строку чтобы отличить от выбора варианта
    await get().submitAnswer('');
  },

  reset: () => {
    set({
      currentQuestion: null,
      isLoading: false,
      error: null,
      selectedAnswer: null,
      feedback: null,
      sessionId: null,
      questionIndex: 0,
      answers: [],
      result: null,
      recentMeaningIds: [],
      recentGenerators: [],
      collectionId: undefined,
    });
  },

  setCollectionId: (id) => {
    set({
      collectionId: id,
      recentMeaningIds: [],
      recentGenerators: [],
      currentQuestion: null,
      feedback: null,
      selectedAnswer: null,
    });
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function useGameQuestion() {
  return useUnifiedGameStore((s) => s.currentQuestion);
}

export function useGameFeedback() {
  return useUnifiedGameStore((s) => s.feedback);
}

export function useGameStreak() {
  return useUnifiedGameStore((s) => s.streak);
}

export function useGameLoading() {
  return useUnifiedGameStore((s) => s.isLoading);
}

export function useGameError() {
  return useUnifiedGameStore((s) => s.error);
}

export function useSessionResult() {
  return useUnifiedGameStore((s) => s.result);
}

export function useSessionProgress() {
  return useUnifiedGameStore((s) => ({
    index: s.questionIndex,
    total: s.maxQuestions,
  }));
}

// Хелпер для создания RewardDisplay из feedback
export function createRewardDisplay(
  feedback: AnswerFeedback,
  key: number,
): RewardDisplay | null {
  if (!feedback.isCorrect || feedback.xpEarned === undefined) return null;

  return {
    xp: feedback.xpEarned,
    xpMultiplier: (feedback.xpModifier ?? 100) / 100,
    lp: feedback.lpEarned ?? 0,
    lpMultiplier: (feedback.lpModifier ?? 100) / 100,
    levelUp: feedback.levelUp,
    key,
  };
}
