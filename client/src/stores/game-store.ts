import { create } from 'zustand';
import type { QuizQuestion, QuizQuestionBase, QuizResultResponse } from '@/types/api';
import { quizStart, quizAnswer, quizFinish } from '@/lib/api';

type AnswerRecord = {
  meaningId: number;
  selectedMeaningId: number | null;
  isCorrect: boolean;
};

type GameState = {
  sessionId: number | null;
  currentQuestion: QuizQuestion | null;
  questionIndex: number;
  answers: AnswerRecord[];
  result: QuizResultResponse | null;
  isLoading: boolean;
  answerFeedback: { isCorrect: boolean; correctTranslation: string } | null;
  startQuiz: () => Promise<void>;
  submitAnswer: (selectedMeaningId: number | null, answerTimeMs: number) => Promise<void>;
  reset: () => void;
};

export const useGameStore = create<GameState>()((set, get) => ({
  sessionId: null,
  currentQuestion: null,
  questionIndex: 0,
  answers: [],
  result: null,
  isLoading: false,
  answerFeedback: null,

  startQuiz: async () => {
    set({ isLoading: true, answers: [], result: null, questionIndex: 0, answerFeedback: null });
    try {
      const res = await quizStart();
      set({ sessionId: res.sessionId, currentQuestion: res.question, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error('Не удалось начать квиз');
    }
  },

  submitAnswer: async (selectedMeaningId, answerTimeMs) => {
    const { sessionId, currentQuestion, answers, questionIndex } = get();
    if (!sessionId || !currentQuestion) return;

    set({ isLoading: true });
    try {
      const q = currentQuestion as QuizQuestionBase;
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
        answerFeedback: { isCorrect: res.isCorrect, correctTranslation: q.correctTranslation ?? '' },
        isLoading: false,
      });

      if (res.isFinished) {
        const result = await quizFinish(sessionId);
        set({ result, currentQuestion: null });
      } else {
        // Delay before showing next question for feedback
        setTimeout(() => {
          set({
            currentQuestion: res.nextQuestion,
            questionIndex: questionIndex + 1,
            answerFeedback: null,
          });
        }, 1200);
      }
    } catch {
      set({ isLoading: false });
      throw new Error('Ошибка при отправке ответа');
    }
  },

  reset: () => {
    set({
      sessionId: null,
      currentQuestion: null,
      questionIndex: 0,
      answers: [],
      result: null,
      isLoading: false,
      answerFeedback: null,
    });
  },
}));
