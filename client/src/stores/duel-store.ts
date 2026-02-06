import { create } from 'zustand';
import type { Duel, DuelCreateResponse, QuizQuestion, QuizResultResponse } from '@/types/api';
import type { AnswerFeedback } from '@/types/game';
import { duelCreate, duelJoin, duelGet, duelFinish, quizAnswer, quizFinish } from '@/lib/api';

type DuelPhase = 'loading' | 'playing' | 'waiting_opponent' | 'finished';

type DuelState = {
  duel: (Duel | DuelCreateResponse) | null;
  sessionId: number | null;
  currentQuestion: QuizQuestion | null;
  questionIndex: number;
  answerFeedback: AnswerFeedback | null;
  quizResult: QuizResultResponse | null;
  winnerId: number | null;
  isLoading: boolean;
  pollingId: ReturnType<typeof setInterval> | null;
  phase: DuelPhase;
  createDuel: () => Promise<void>;
  joinDuel: (id: number) => Promise<void>;
  fetchDuel: (id: number) => Promise<void>;
  startPolling: (id: number) => void;
  stopPolling: () => void;
  submitAnswer: (selectedMeaningId: number | null, answerTimeMs: number) => Promise<void>;
  startWaitingForOpponent: (duelId: number) => void;
  finishDuel: () => Promise<void>;
  reset: () => void;
};

const POLL_INTERVAL = 2000;

export const useDuelStore = create<DuelState>()((set, get) => ({
  duel: null,
  sessionId: null,
  currentQuestion: null,
  questionIndex: 0,
  answerFeedback: null,
  quizResult: null,
  winnerId: null,
  isLoading: false,
  pollingId: null,
  phase: 'loading',

  createDuel: async () => {
    set({ isLoading: true });
    try {
      const res = await duelCreate();
      set({ duel: res, sessionId: res.challengerSessionId, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error('Не удалось создать дуэль');
    }
  },

  joinDuel: async (id) => {
    set({ isLoading: true });
    try {
      const res = await duelJoin(id);
      set({ duel: res, sessionId: res.opponentSessionId, isLoading: false });
    } catch {
      set({ isLoading: false });
      throw new Error('Не удалось присоединиться к дуэли');
    }
  },

  fetchDuel: async (id) => {
    try {
      const duel = await duelGet(id);
      set({ duel });
    } catch {
      // silent
    }
  },

  startPolling: (id) => {
    get().stopPolling();
    const pollingId = setInterval(() => {
      get().fetchDuel(id);
    }, POLL_INTERVAL);
    set({ pollingId });
  },

  stopPolling: () => {
    const { pollingId } = get();
    if (pollingId) {
      clearInterval(pollingId);
      set({ pollingId: null });
    }
  },

  submitAnswer: async (selectedMeaningId, answerTimeMs) => {
    const { sessionId, currentQuestion, questionIndex } = get();
    if (!sessionId || !currentQuestion) return;

    set({ isLoading: true });
    try {
      const res = await quizAnswer({
        sessionId,
        meaningId: currentQuestion.meaningId,
        selectedMeaningId,
        answerTimeMs,
      });

      set({
        answerFeedback: { isCorrect: res.isCorrect, correctAnswer: res.correctTranslation ?? '' },
        isLoading: false,
      });

      if (res.isFinished) {
        const quizResult = await quizFinish(sessionId);
        set({ quizResult, currentQuestion: null });
      } else {
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
    }
  },

  startWaitingForOpponent: (duelId) => {
    set({ phase: 'waiting_opponent' });
    get().stopPolling();

    // Poll until opponent finishes, then auto-finish
    const pollingId = setInterval(async () => {
      await get().fetchDuel(duelId);
      const updatedDuel = get().duel;

      if (!updatedDuel || !('opponentSession' in updatedDuel)) return;
      const d = updatedDuel as Duel;

      const bothFinished = d.challengerSession?.finishedAt && d.opponentSession?.finishedAt;
      if (bothFinished || d.status === 'finished') {
        get().stopPolling();
        await get().finishDuel();
        set({ phase: 'finished' });
      }
    }, POLL_INTERVAL);
    set({ pollingId });
  },

  finishDuel: async () => {
    const { duel } = get();
    if (!duel) return;
    try {
      const res = await duelFinish(duel.id);
      set({ winnerId: res.winnerId });
    } catch {
      // silent
    }
  },

  reset: () => {
    get().stopPolling();
    set({
      duel: null,
      sessionId: null,
      currentQuestion: null,
      questionIndex: 0,
      answerFeedback: null,
      quizResult: null,
      winnerId: null,
      isLoading: false,
      phase: 'loading',
    });
  },
}));
