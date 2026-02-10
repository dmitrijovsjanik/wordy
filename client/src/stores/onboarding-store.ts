import { create } from 'zustand';
import type { CefrLevel, PlacementQuestion, PlacementCompleteResponse } from '@/types/api';
import { placementStart, placementAnswer, placementComplete, placementFinalize, placementSkip } from '@/lib/api';

type OnboardingStep = 'welcome' | 'self-assessment' | 'quiz' | 'analyzing' | 'result';

type OnboardingState = {
  step: OnboardingStep;
  selfAssessment: CefrLevel | null;
  currentQuestion: PlacementQuestion | null;
  questionNumber: number;
  totalQuestions: number;
  isLoading: boolean;
  isAnswered: boolean;
  lastAnswerCorrect: boolean | null;
  selectedOption: string | null;
  answerStartTime: number;
  correctCount: number;
  resultCefr: CefrLevel | null;
  estimatedVocabulary: number | null;
  percentile: number | null;

  isFinalizing: boolean;

  setStep: (step: OnboardingStep) => void;
  setSelfAssessment: (level: CefrLevel) => void;
  startQuiz: () => Promise<void>;
  submitAnswer: (option: string) => Promise<void>;
  completeQuiz: () => Promise<void>;
  finalize: (mode: 'all' | 'current-only') => Promise<void>;
  skipWithLevel: (level: CefrLevel) => Promise<void>;
  reset: () => void;
};

const initialState = {
  step: 'welcome' as OnboardingStep,
  selfAssessment: null as CefrLevel | null,
  currentQuestion: null as PlacementQuestion | null,
  questionNumber: 1,
  totalQuestions: 12,
  isLoading: false,
  isAnswered: false,
  lastAnswerCorrect: null as boolean | null,
  selectedOption: null as string | null,
  answerStartTime: 0,
  correctCount: 0,
  resultCefr: null as CefrLevel | null,
  estimatedVocabulary: null as number | null,
  percentile: null as number | null,
  isFinalizing: false,
};

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  ...initialState,

  setStep: (step) => set({ step }),

  setSelfAssessment: (level) => set({ selfAssessment: level }),

  startQuiz: async () => {
    const { selfAssessment } = get();
    set({ isLoading: true });
    try {
      const res = await placementStart(selfAssessment ?? undefined);
      set({
        currentQuestion: res.question,
        questionNumber: res.questionNumber,
        totalQuestions: res.totalQuestions,
        answerStartTime: Date.now(),
        step: 'quiz',
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  submitAnswer: async (option) => {
    const { currentQuestion, answerStartTime } = get();
    if (!currentQuestion || get().isAnswered) return;

    const answerTimeMs = Date.now() - answerStartTime;
    const answeredAt = Date.now();

    // Немедленная визуальная обратная связь
    set({ selectedOption: option, isAnswered: true });

    try {
      const res = await placementAnswer(currentQuestion.meaningId, option, answerTimeMs);

      const isCorrect = res.isCorrect;
      set((state) => ({
        lastAnswerCorrect: isCorrect,
        correctCount: isCorrect ? state.correctCount + 1 : state.correctCount,
      }));

      // Ждём 800мс с момента нажатия для плавного UX
      const elapsed = Date.now() - answeredAt;
      const remaining = Math.max(0, 800 - elapsed);

      await new Promise((resolve) => setTimeout(resolve, remaining));

      if (res.isFinished) {
        await get().completeQuiz();
      } else {
        set({
          currentQuestion: res.nextQuestion,
          questionNumber: res.questionNumber,
          answerStartTime: Date.now(),
          isAnswered: false,
          selectedOption: null,
          lastAnswerCorrect: null,
        });
      }
    } catch {
      set({ isAnswered: false, selectedOption: null });
    }
  },

  completeQuiz: async () => {
    set({ step: 'analyzing' });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    try {
      const res: PlacementCompleteResponse = await placementComplete();
      set({
        resultCefr: res.cefr,
        estimatedVocabulary: res.estimatedVocabulary,
        percentile: res.percentile,
        step: 'result',
      });
    } catch {
      // При ошибке всё равно показываем результат
      set({ step: 'result' });
    }
  },

  finalize: async (mode) => {
    set({ isFinalizing: true });
    try {
      await placementFinalize(mode);
    } finally {
      set({ isFinalizing: false });
    }
  },

  skipWithLevel: async (level) => {
    await placementSkip(level);
  },

  reset: () => set({ ...initialState }),
}));
