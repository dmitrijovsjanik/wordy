import { create } from 'zustand';
import type { ReadingPassage, ReadingLevel } from '@/types/reading';
import { getNextReadingPassage, submitReadingAnswer } from '@/lib/api';

type ReadingPhase = 'select-level' | 'loading' | 'reading' | 'question' | 'finished';

type AnswerResult = {
  questionIndex: number;
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
};

type ReadingState = {
  phase: ReadingPhase;
  passage: ReadingPassage | null;
  passageIndex: number;
  level: ReadingLevel | null;
  showTranslation: boolean;
  currentQuestionIdx: number;
  answers: AnswerResult[];
  correctCount: number;
  error: string | null;
  feedbackVisible: boolean;

  setLevel: (level: ReadingLevel | null) => void;
  fetchNext: () => Promise<void>;
  goToQuestions: () => void;
  toggleTranslation: () => void;
  submitAnswer: (answerIndex: number) => Promise<void>;
  nextQuestion: () => void;
  reset: () => void;
};

export const useReadingStore = create<ReadingState>()((set, get) => ({
  phase: 'select-level',
  passage: null,
  passageIndex: 0,
  level: null,
  showTranslation: false,
  currentQuestionIdx: 0,
  answers: [],
  correctCount: 0,
  error: null,
  feedbackVisible: false,

  setLevel: (level) => set({ level }),

  fetchNext: async () => {
    set({ phase: 'loading', error: null, showTranslation: false, feedbackVisible: false });
    try {
      const { level } = get();
      const result = await getNextReadingPassage(level ?? undefined);
      set({
        passage: result.passage,
        passageIndex: result.passageIndex,
        phase: 'reading',
        currentQuestionIdx: 0,
        answers: [],
        correctCount: 0,
      });
    } catch {
      set({ error: 'Не удалось загрузить текст', phase: 'loading' });
    }
  },

  goToQuestions: () => set({ phase: 'question', currentQuestionIdx: 0, feedbackVisible: false }),

  toggleTranslation: () => set((s) => ({ showTranslation: !s.showTranslation })),

  submitAnswer: async (answerIndex) => {
    const { passageIndex, currentQuestionIdx, level, answers, correctCount } = get();
    try {
      const result = await submitReadingAnswer({
        passageIndex,
        questionIndex: currentQuestionIdx,
        answerIndex,
        level: level ?? undefined,
      });

      const answer: AnswerResult = {
        questionIndex: currentQuestionIdx,
        selectedIndex: answerIndex,
        correctIndex: result.correctIndex,
        isCorrect: result.isCorrect,
      };

      set({
        answers: [...answers, answer],
        correctCount: result.isCorrect ? correctCount + 1 : correctCount,
        feedbackVisible: true,
      });
    } catch {
      set({ error: 'Не удалось проверить ответ' });
    }
  },

  nextQuestion: () => {
    const { currentQuestionIdx, passage } = get();
    if (!passage) return;

    const nextIdx = currentQuestionIdx + 1;
    if (nextIdx >= passage.questions.length) {
      set({ phase: 'finished' });
    } else {
      set({ currentQuestionIdx: nextIdx, feedbackVisible: false });
    }
  },

  reset: () =>
    set({
      phase: 'select-level',
      passage: null,
      passageIndex: 0,
      level: null,
      showTranslation: false,
      currentQuestionIdx: 0,
      answers: [],
      correctCount: 0,
      error: null,
      feedbackVisible: false,
    }),
}));
