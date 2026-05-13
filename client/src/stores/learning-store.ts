/**
 * Zustand store для нового learning-flow (v2): лестница pool/passive/active/review/mastered.
 *
 * Заменяет unified-game-store для главного экрана /vocabulary/learn. Старый
 * store остаётся для других экранов (duels/grammar) до cleanup-этапа.
 *
 *   - Окно anti-repeat = 3 wordId (последние показанные), кап на сервере = 10
 *   - Нет K-cooldown — anti-repeat только через excludeWordIds
 *   - Нет embedded_review как отдельного режима — L0 это обычный pool-card в потоке
 *   - На L3 после ответа клиент рендерит 4 grade-кнопки (Снова/Трудно/Хорошо/Легко),
 *     submitAnswer вызывается ВТОРОЙ раз с grade. Авто-переход через 1.2с — только
 *     для L0/L1/L2 (где grade не нужен).
 *   - session_complete — soft-end экран с nextDueAt
 */

import { create } from 'zustand';
import type {
  LearningTier,
  QuizQuestion,
  ReviewGrade,
  PoolSwipeAction,
  LearningAnswerResponse,
  DailyPromotionsInfo,
} from '@/types/api';
import type { AnswerHistoryEntry } from '@/types/game';
import { learningNext, learningAnswer, learningSwipe } from '@/lib/api';
import { useLeagueStore } from './league-store';

const ANTI_REPEAT_WINDOW = 3;
const HISTORY_MAX = 200;
const QUESTION_KEY = 'wordy:v2:currentQuestion';
const STREAK_KEY = 'wordy:v2:streak';
const HISTORY_KEY = 'wordy:v2:answerHistory';
const HISTORY_DATE_KEY = 'wordy:v2:answerHistoryDate';

// ─── localStorage helpers ──────────────────────────────────────────────────

function loadStreak(): number {
  const raw = localStorage.getItem(STREAK_KEY);
  return raw ? Number(raw) || 0 : 0;
}
function saveStreak(n: number) { localStorage.setItem(STREAK_KEY, String(n)); }

function loadQuestion(): QuizQuestion | null {
  try {
    const raw = sessionStorage.getItem(QUESTION_KEY);
    return raw ? (JSON.parse(raw) as QuizQuestion) : null;
  } catch { return null; }
}
function saveQuestion(q: QuizQuestion | null) {
  if (q) sessionStorage.setItem(QUESTION_KEY, JSON.stringify(q));
  else sessionStorage.removeItem(QUESTION_KEY);
}

/** МСК-день для границы истории (04:00 МСК = 01:00 UTC). */
function getMskDay(): string {
  const now = new Date();
  const mskMs = now.getTime() + 3 * 60 * 60 * 1000;
  const adjusted = new Date(mskMs - 4 * 60 * 60 * 1000);
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
    return raw ? (JSON.parse(raw) as AnswerHistoryEntry[]) : [];
  } catch { return []; }
}
function saveHistory(entries: AnswerHistoryEntry[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
  localStorage.setItem(HISTORY_DATE_KEY, getMskDay());
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getQuestionText(q: QuizQuestion): string {
  if (q.type === 'pool-card') return q.word;
  if (q.type === 'passive-recall') return q.word;
  return q.prompt; // free-recall
}

function getCorrectAnswer(q: QuizQuestion): string {
  if (q.type === 'pool-card') return q.meanings[0]?.translation ?? '';
  if (q.type === 'passive-recall') return q.translation;
  return q.acceptableAnswers[0] ?? ''; // free-recall
}

// ─── Store types ────────────────────────────────────────────────────────────

export type SessionCompleteState = {
  mode: 'session_complete';
  reason: 'all_in_cooldown' | 'collection_exhausted' | 'no_words' | 'daily_limit_done' | 'all_recent';
  nextDueAt: string | null;
  counts: {
    pool: number;
    passive: number;
    active: number;
    review: number;
    mastered: number;
  };
};

type LearningV2State = {
  currentQuestion: QuizQuestion | null;
  currentTier: LearningTier | null;
  currentWordId: number | null;
  /** Окно anti-repeat (последние 3 wordId). */
  recentWordIds: number[];
  /** session_complete экран (если активен). */
  sessionComplete: SessionCompleteState | null;
  /** Последний feedback ответа — для рендера ✓/✗ и наград. */
  feedback: (LearningAnswerResponse & { wordId: number }) | null;
  isLoading: boolean;
  error: string | null;
  streak: number;
  collectionId: number | undefined;
  /** История ответов за день — для drawer-а. */
  answerHistory: AnswerHistoryEntry[];
  lastUserAnswer: string | null;
  /** Текущее состояние дневного лимита изучения (count / limit). null до первого fetchNext. */
  dailyPromotions: DailyPromotionsInfo | null;
  /** Эфемерный флаг: только что стартовал батч изучения, показать экран
   *  «Ты отобрал N слов». UI сбрасывает в null после показа. */
  pendingBatchStarted: { size: number } | null;
  /** Эфемерный флаг: только что превысили дневной лимит. UI показывает
   *  экран «Ты изучил N слов» и сбрасывает в null. */
  pendingDailyLimitReached: boolean;

  // ── actions ──
  setCollectionId: (id: number | undefined) => void;
  fetchNext: () => Promise<void>;
  /** L0/L1/L2 ответ. На L3 не вызывается — там используется submitWithGrade. */
  submitAnswer: (isCorrect: boolean, userAnswer?: string, skip?: boolean) => Promise<void>;
  /** L3 grade — кнопки Снова/Трудно/Хорошо/Легко. Также инициирует переход к следующему. */
  submitGrade: (grade: ReviewGrade, userAnswer?: string) => Promise<void>;
  /** L0 свайп — Знаю/Изучаю/Отложить. */
  poolSwipe: (action: PoolSwipeAction) => Promise<void>;
  /** Пропуск (для L1/L2 = ответ null, без траты жизни). На L3 не используется. */
  skip: () => Promise<void>;
  setLastUserAnswer: (a: string | null) => void;
  clearHistory: () => void;
  /** Сбрасывает pendingBatchStarted — UI вызывает после показа экрана. */
  consumeBatchStarted: () => void;
  /** Сбрасывает pendingDailyLimitReached — UI вызывает после выбора CTA. */
  consumeDailyLimitReached: () => void;
  reset: () => void;
};

// ─── Store ──────────────────────────────────────────────────────────────────

export const useLearningStore = create<LearningV2State>()((set, get) => ({
  currentQuestion: loadQuestion(),
  currentTier: null,
  currentWordId: null,
  recentWordIds: [],
  sessionComplete: null,
  feedback: null,
  isLoading: false,
  error: null,
  streak: loadStreak(),
  collectionId: undefined,
  answerHistory: loadHistory(),
  lastUserAnswer: null,
  dailyPromotions: null,
  pendingBatchStarted: null,
  pendingDailyLimitReached: false,

  consumeBatchStarted: () => set({ pendingBatchStarted: null }),
  consumeDailyLimitReached: () => set({ pendingDailyLimitReached: false }),

  setCollectionId: (id) => {
    saveQuestion(null);
    set({
      collectionId: id,
      currentQuestion: null,
      currentTier: null,
      currentWordId: null,
      recentWordIds: [],
      sessionComplete: null,
      feedback: null,
    });
  },

  setLastUserAnswer: (a) => set({ lastUserAnswer: a }),

  clearHistory: () => {
    saveHistory([]);
    set({ answerHistory: [] });
  },

  fetchNext: async () => {
    if (get().isLoading) return;
    // Обнуляем sessionComplete и feedback на старте — иначе stale state мог бы
    // показать «На сегодня всё» вспышкой между запросом и ответом.
    set({ isLoading: true, error: null, sessionComplete: null, feedback: null });
    try {
      const { recentWordIds, collectionId } = get();
      const res = await learningNext({
        collectionId,
        excludeWordIds: recentWordIds,
      });

      if ('mode' in res && res.mode === 'session_complete') {
        saveQuestion(null);
        // Если reason='all_recent' — anti-repeat накрыл всё. Сбрасываем recentWordIds
        // и retry. Один раз; если снова session_complete — реально пусто.
        if (res.reason === 'all_recent' && get().recentWordIds.length > 0) {
          set({ recentWordIds: [], isLoading: false });
          return get().fetchNext();
        }
        set({
          sessionComplete: {
            mode: 'session_complete',
            reason: res.reason,
            nextDueAt: res.nextDueAt,
            counts: res.counts,
          },
          currentQuestion: null,
          currentTier: null,
          currentWordId: null,
          feedback: null,
          isLoading: false,
          dailyPromotions: res.dailyPromotions,
          // daily_limit_done → ставим эфемерный флаг для экрана «Ты изучил N»
          pendingDailyLimitReached: res.reason === 'daily_limit_done',
        });
        return;
      }

      saveQuestion(res.question);
      console.log('[learning-store] fetchNext got question', { tier: res.tier, wordId: res.wordId, type: res.question?.type, batchStarted: res.batchStarted });
      set({
        currentQuestion: res.question,
        currentTier: res.tier,
        currentWordId: res.wordId,
        sessionComplete: null,
        feedback: null,
        isLoading: false,
        dailyPromotions: res.dailyPromotions,
        // batchStarted=true → ставим эфемерный флаг для экрана «Ты отобрал N»
        pendingBatchStarted: res.batchStarted ? { size: res.batchSize } : get().pendingBatchStarted,
      });
    } catch (e) {
      console.error('[learning-store] fetchNext error', e);
      set({ isLoading: false, error: 'Не удалось загрузить вопрос' });
    }
  },

  submitAnswer: async (isCorrect, userAnswer, skip) => {
    const { currentQuestion, currentTier, currentWordId, recentWordIds, lastUserAnswer } = get();
    if (!currentQuestion || currentWordId === null) return;
    // L3 идёт через submitGrade
    if (currentTier === 'review') return;

    set({ isLoading: true });
    try {
      const isFreeInput = currentQuestion.type === 'free-recall';
      const res = await learningAnswer({
        wordId: currentWordId,
        isCorrect,
        questionType: currentQuestion.type,
        streak: get().streak,
        skip,
        userAnswer,
        ...(isFreeInput
          ? {
              acceptableAnswers: (currentQuestion as Extract<QuizQuestion, { type: 'free-recall' }>).acceptableAnswers,
              partOfSpeech: (currentQuestion as Extract<QuizQuestion, { type: 'free-recall' }>).partOfSpeech,
            }
          : {}),
      });

      const updatedRecent = [...recentWordIds, currentWordId].slice(-ANTI_REPEAT_WINDOW);
      const newStreak = res.isCorrect ? get().streak + 1 : 0;
      saveStreak(newStreak);
      if (res.totalLp !== undefined) useLeagueStore.getState().updateLp(res.totalLp);

      const answerText = userAnswer ?? lastUserAnswer ?? (res.isCorrect ? getCorrectAnswer(currentQuestion) : '—');
      const entry: AnswerHistoryEntry = {
        question: getQuestionText(currentQuestion),
        userAnswer: answerText,
        correctAnswer: res.correctedTo ?? getCorrectAnswer(currentQuestion),
        isCorrect: res.isCorrect,
        type: currentQuestion.type,
        timestamp: Date.now(),
      };
      const updatedHistory = [entry, ...get().answerHistory].slice(0, HISTORY_MAX);
      saveHistory(updatedHistory);

      set({
        feedback: { ...res, wordId: currentWordId },
        recentWordIds: updatedRecent,
        streak: newStreak,
        answerHistory: updatedHistory,
        lastUserAnswer: null,
        isLoading: false,
      });

      // Авто-переход к следующему вопросу. Задержка зависит от типа карточки:
      //   - passive-recall (L1): 0мс. Карточка сама показывает ✓/✗ overlay 120мс
      //     перед вызовом onAnswer, поэтому юзер уже видел verdict. Дополнительная
      //     пауза тут только тормозит поток.
      //   - free-recall (L2 active): 1200мс. Юзер должен увидеть правильный
      //     ответ если ввёл с ошибкой.
      // L3 review идёт через submitGrade, не сюда.
      const delay = currentQuestion.type === 'passive-recall' ? 0 : 1200;
      setTimeout(() => {
        set({ feedback: null });
        get().fetchNext();
      }, delay);
    } catch {
      set({ isLoading: false, error: 'Ошибка при отправке ответа' });
    }
  },

  submitGrade: async (grade, userAnswer) => {
    const { currentQuestion, currentTier, currentWordId, recentWordIds, lastUserAnswer } = get();
    if (!currentQuestion || currentWordId === null || currentTier !== 'review') return;

    set({ isLoading: true });
    try {
      const res = await learningAnswer({
        wordId: currentWordId,
        grade,
        questionType: currentQuestion.type,
        streak: get().streak,
        userAnswer,
        ...(currentQuestion.type === 'free-recall'
          ? {
              acceptableAnswers: currentQuestion.acceptableAnswers,
              partOfSpeech: currentQuestion.partOfSpeech,
            }
          : {}),
      });

      const updatedRecent = [...recentWordIds, currentWordId].slice(-ANTI_REPEAT_WINDOW);
      // На L3 grade — стрик зависит от того, прошёл ли ответ (не от выбранной кнопки).
      // res.isCorrect для grade-flow = было ли подтверждено сервером (через
      // userAnswer/acceptableAnswers normalization). Если ввода не было —
      // считаем что grade=good/easy/hard ⇒ correct, grade=again ⇒ wrong.
      const wasCorrect = res.isCorrect || (userAnswer === undefined && grade !== 'again');
      const newStreak = wasCorrect ? get().streak + 1 : 0;
      saveStreak(newStreak);
      if (res.totalLp !== undefined) useLeagueStore.getState().updateLp(res.totalLp);

      const answerText = userAnswer ?? lastUserAnswer ?? getCorrectAnswer(currentQuestion);
      const entry: AnswerHistoryEntry = {
        question: getQuestionText(currentQuestion),
        userAnswer: answerText,
        correctAnswer: res.correctedTo ?? getCorrectAnswer(currentQuestion),
        isCorrect: wasCorrect,
        type: currentQuestion.type,
        timestamp: Date.now(),
      };
      const updatedHistory = [entry, ...get().answerHistory].slice(0, HISTORY_MAX);
      saveHistory(updatedHistory);

      set({
        feedback: { ...res, wordId: currentWordId },
        recentWordIds: updatedRecent,
        streak: newStreak,
        answerHistory: updatedHistory,
        lastUserAnswer: null,
        isLoading: false,
      });

      // На L3 переход к следующему — сразу после grade-клика, без 1.2с задержки.
      // Юзер уже видел результат + кнопки, дополнительная задержка не нужна.
      set({ feedback: null });
      get().fetchNext();
    } catch {
      set({ isLoading: false, error: 'Ошибка при отправке ответа' });
    }
  },

  poolSwipe: async (action) => {
    const { currentQuestion, currentWordId, recentWordIds, collectionId } = get();
    if (!currentQuestion || currentQuestion.type !== 'pool-card' || currentWordId === null) return;
    set({ isLoading: true });
    try {
      const res = await learningSwipe({ wordId: currentWordId, action, collectionId });
      const updatedRecent = [...recentWordIds, currentWordId].slice(-ANTI_REPEAT_WINDOW);
      set({
        recentWordIds: updatedRecent,
        isLoading: false,
        // batchStarted от swipe → ставим эфемерный флаг для экрана «Ты отобрал N»
        pendingBatchStarted: res.batchStarted ? { size: res.batchSize } : get().pendingBatchStarted,
      });
      await get().fetchNext();
    } catch {
      set({ isLoading: false, error: 'Не удалось сохранить свайп' });
    }
  },

  skip: async () => {
    const { currentQuestion, currentTier } = get();
    if (!currentQuestion) return;
    if (currentQuestion.type === 'pool-card') return; // pool скипа нет
    if (currentTier === 'review') return; // L3 скипа нет — там grade
    await get().submitAnswer(false, undefined, true);
  },

  reset: () => {
    saveQuestion(null);
    set({
      currentQuestion: null,
      currentTier: null,
      currentWordId: null,
      recentWordIds: [],
      sessionComplete: null,
      feedback: null,
      isLoading: false,
      error: null,
      collectionId: undefined,
      lastUserAnswer: null,
    });
  },
}));

// Dev-only: экспорт в window для дебага из консоли DevTools.
// `useLearningStore.getState()` доступен в браузере без переписывания imports.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { useLearningStore: typeof useLearningStore }).useLearningStore = useLearningStore;
}
