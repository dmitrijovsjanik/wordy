import { create } from 'zustand';
import type { QuizQuestion, InfiniteAnswerResponse, LearningTier, LearningAnswerResponse } from '@/types/api';
import type { AnswerHistoryEntry } from '@/types/game';
import { quizNext, quizAnswerInfinite, quizAnswerMatchPairs, refillLives, learningNext, learningAnswer, learningProblemsNext, learningDemoReset } from '@/lib/api';
import { useLeagueStore } from './league-store';

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
  if (q.type === 'listening' || q.type === 'dictation') return q.audioWord;
  if (q.type === 'free-recall') return q.prompt;
  return q.word;
}

/** Извлекает правильный ответ из QuizQuestion */
function getCorrectAnswer(q: QuizQuestion): string {
  if (q.type === 'match-pairs') return '';
  if (q.type === 'listening') return q.correctAnswer;
  if (q.type === 'dictation') return q.correctAnswer;
  if (q.type === 'free-recall') return q.acceptableAnswers[0] ?? '';
  if (q.type === 'encounter') return q.translation;
  if (q.type === 'passive-recall') return q.translation;
  if (q.type === 'cloze-input') return q.correctAnswer;
  return q.correctTranslation ?? '';
}

export type QuestionGeneratorMode =
  | 'auto'          // Случайное направление, multiple-choice
  | 'en-ru'         // EN → RU, multiple-choice
  | 'ru-en'         // RU → EN, multiple-choice
  | 'match-pairs';  // Соединение пар

/** Определяет тип генератора из ответа сервера */
function getGeneratorTypeFromQuestion(question: QuizQuestion): string {
  if (question.type === 'match-pairs') return 'match-pairs';
  if (question.type === 'listening') return 'listening';
  if (question.type === 'dictation') return 'dictation';
  if (question.type === 'free-recall') return 'free-recall';
  if (question.type === 'encounter') return 'encounter';
  if (question.type === 'passive-recall') return 'passive-recall';
  if (question.type === 'cloze-input') return 'cloze-input';
  // QuizQuestionBase — единственный с .direction
  return 'direction' in question && typeof question.direction === 'string' ? question.direction : 'en-ru';
}

type UnifiedGameState = {
  currentQuestion: QuizQuestion | null;
  /** Источник текущего вопроса: 'learning' = новая лестница, 'quiz' = старый /api/quiz, null = не загружен. */
  currentQuestionSource: 'learning' | 'quiz' | null;
  /** Текущий tier из learning-API, если источник = 'learning'. Используется для 3-сигнального индикатора прогресса. */
  currentTier: LearningTier | null;
  recentMeaningIds: number[];
  recentGenerators: string[];
  feedback: (InfiniteAnswerResponse & { meaningId: number }) | null;
  isLoading: boolean;
  error: string | null;
  streak: number;
  collectionId: number | undefined;
  generatorMode: QuestionGeneratorMode;
  /** Режим «Проблемные слова» — fetchNext идёт на /api/learning/problems/next.
   *  Включается с экрана /problems, выключается при уходе оттуда. */
  problemsMode: boolean;
  /** Демо-режим: фиксируем одно слово и проводим его через все уровни.
   *  Сервер возвращает question=null когда слово достигло review (lock на дни)
   *  — клиент по этому показывает «Демо завершено». */
  demoMeaningId: number | null;
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

  setCollectionId: (id: number | undefined) => void;
  setGeneratorMode: (mode: QuestionGeneratorMode) => void;
  setProblemsMode: (on: boolean) => void;
  startDemo: () => Promise<void>;
  exitDemo: () => Promise<void>;
  fetchNext: () => Promise<void>;
  submitAnswer: (selectedMeaningId: number | null, userAnswer?: string, skip?: boolean) => Promise<void>;
  submitEncounter: () => Promise<void>;
  submitPassiveRecall: (knew: boolean) => Promise<void>;
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

/**
 * Адаптер: ответ от /api/learning/answer → формат InfiniteAnswerResponse,
 * который ожидает home.tsx (feedback panel). Сохраняем существующий UX.
 */
function adaptLearningResponse(
  res: LearningAnswerResponse,
  meaningId: number,
  correctTranslation: string,
): InfiniteAnswerResponse & { meaningId: number } {
  return {
    isCorrect: res.isCorrect,
    correctTranslation,
    xpEarned: res.xpEarned,
    xpModifier: res.xpModifier,
    totalXp: res.totalXp,
    level: res.level,
    levelUp: res.levelUp,
    lpEarned: res.lpEarned,
    lpModifier: res.lpModifier,
    totalLp: res.totalLp,
    gemsEarned: res.gemsEarned,
    lives: res.lives,
    livesRestoredAt: res.livesRestoredAt,
    livesExhausted: res.livesExhausted,
    meaningId,
  };
}

/** Использовать learning-API только для auto-режима без выбранной коллекции.
 *  Для en-ru/ru-en/match-pairs или конкретной коллекции — старый /api/quiz. */
function shouldUseLearningApi(generatorMode: QuestionGeneratorMode, collectionId: number | undefined): boolean {
  if (generatorMode !== 'auto') return false;
  if (collectionId !== undefined) return false;
  return true;
}

export const useUnifiedGameStore = create<UnifiedGameState>()((set, get) => ({
  currentQuestion: loadQuestion(),
  currentQuestionSource: null,
  currentTier: null,
  recentMeaningIds: [],
  recentGenerators: [],
  feedback: null,
  isLoading: false,
  error: null,
  streak: loadStreak(),
  collectionId: undefined,
  generatorMode: 'auto',
  problemsMode: false,
  demoMeaningId: null,
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
  setProblemsMode: (on) => {
    saveQuestion(null);
    set({
      problemsMode: on,
      recentMeaningIds: [],
      recentGenerators: [],
      currentQuestion: null,
      feedback: null,
    });
  },

  startDemo: async () => {
    set({ isLoading: true });
    try {
      const res = await learningDemoReset();
      if (!res.ok || !res.meaningId) {
        set({ isLoading: false, error: res.error ?? 'Не удалось запустить демо' });
        return;
      }
      saveQuestion(null);
      set({
        demoMeaningId: res.meaningId,
        problemsMode: false,
        currentQuestion: null,
        feedback: null,
        recentMeaningIds: [],
        recentGenerators: [],
        isLoading: false,
        error: null,
      });
      await get().fetchNext();
    } catch {
      set({ isLoading: false, error: 'Не удалось запустить демо' });
    }
  },

  exitDemo: async () => {
    saveQuestion(null);
    set({
      demoMeaningId: null,
      currentQuestion: null,
      feedback: null,
      recentMeaningIds: [],
      recentGenerators: [],
    });
    await get().fetchNext();
  },

  fetchNext: async () => {
    // Предотвращаем параллельные запросы (важно для React StrictMode)
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const { recentMeaningIds, collectionId, generatorMode, recentGenerators, questionIndex, problemsMode, demoMeaningId } = get();
      const { recentCorrectCount, recentTotalCount } = get();

      // Демо-режим: фиксируем одно meaning, проходим через все уровни.
      // Сервер вернёт question=null когда слово достигло review (lock на дни)
      // — это сигнал «демо завершено», UI покажет соответствующий экран.
      if (demoMeaningId !== null) {
        const res = await learningNext({ lockMeaningId: demoMeaningId, recentGenerators });
        const updatedGenerators = res.question
          ? [...recentGenerators, getGeneratorTypeFromQuestion(res.question)].slice(-MAX_RECENT_GENERATORS)
          : recentGenerators;
        saveQuestion(res.question);
        set({
          currentQuestion: res.question,
          currentQuestionSource: 'learning',
          currentTier: res.tier,
          recentGenerators: updatedGenerators,
          isLoading: false,
          doubleXpTimeLimitMs: null,
          doubleXpExpired: false,
        });
        return;
      }

      // Режим «Проблемные слова»: своя выборка через learning_events,
      // тот же learning-API для submit'а ответа.
      if (problemsMode) {
        const res = await learningProblemsNext({ recentGenerators, excludeMeaningIds: recentMeaningIds });
        const updatedGenerators = res.question
          ? [...recentGenerators, getGeneratorTypeFromQuestion(res.question)].slice(-MAX_RECENT_GENERATORS)
          : recentGenerators;
        saveQuestion(res.question);
        set({
          currentQuestion: res.question,
          currentQuestionSource: 'learning',
          currentTier: res.tier,
          recentGenerators: updatedGenerators,
          isLoading: false,
          doubleXpTimeLimitMs: null,
          doubleXpExpired: false,
        });
        return;
      }

      // Разветвление: для auto-режима без коллекции ошибок используем новую лестницу.
      if (shouldUseLearningApi(generatorMode, collectionId)) {
        const numCollectionId = typeof collectionId === 'number' ? collectionId : undefined;
        // excludeMeaningIds — anti-repeat, без него с 0-cooldown'ом сервер
        // отдавал бы то же слово подряд. Окно специально маленькое (2),
        // чтобы слово быстро вернулось через 2-3 хода и пользователь видел
        // прогресс одного слова: encounter A → passive B → passive A → active A.
        const learningExclude = recentMeaningIds.slice(-2);
        const res = await learningNext({
          collectionId: numCollectionId,
          recentGenerators,
          excludeMeaningIds: learningExclude,
        });
        const updatedGenerators = res.question
          ? [...recentGenerators, getGeneratorTypeFromQuestion(res.question)].slice(-MAX_RECENT_GENERATORS)
          : recentGenerators;
        saveQuestion(res.question);
        set({
          currentQuestion: res.question,
          currentQuestionSource: 'learning',
          currentTier: res.tier,
          recentGenerators: updatedGenerators,
          isLoading: false,
          doubleXpTimeLimitMs: null,
          doubleXpExpired: false,
        });
        return;
      }

      // Старый путь: en-ru/ru-en/match-pairs формат-выбор или конкретная коллекция.
      const res = await quizNext(recentMeaningIds, collectionId, generatorMode, recentGenerators, recentCorrectCount, recentTotalCount, questionIndex);

      // Трекаем тип генератора для авто-ротации

      const updatedGenerators = res.question
        ? [...recentGenerators, getGeneratorTypeFromQuestion(res.question)].slice(-MAX_RECENT_GENERATORS)
        : recentGenerators;

      saveQuestion(res.question);
      const doubleXpTimeLimitMs = (res.question && 'doubleXpTimeLimitMs' in res.question) ? res.question.doubleXpTimeLimitMs ?? null : null;
      set({
        currentQuestion: res.question,
        currentQuestionSource: 'quiz',
        currentTier: null,
        recentGenerators: updatedGenerators,
        isLoading: false,
        doubleXpTimeLimitMs,
        doubleXpExpired: false,
      });
    } catch {
      set({ isLoading: false, error: 'Не удалось загрузить вопрос' });
    }
  },

  submitAnswer: async (selectedMeaningId, userAnswer?, isSkip?) => {
    const { currentQuestion, currentQuestionSource, recentMeaningIds, lastUserAnswer } = get();
    if (!currentQuestion || currentQuestion.type === 'match-pairs') return;

    // После guard'а тип сужен до вопросов с meaningId
    const meaningId = (currentQuestion as Exclude<QuizQuestion, { type: 'match-pairs' }>).meaningId;
    // Encounter: пользователь нажал «Понятно» → всегда isCorrect=true.
    const isEncounter = currentQuestion.type === 'encounter';
    const computedIsCorrect = isEncounter || selectedMeaningId === meaningId;

    set({ isLoading: true });
    try {
      const { doubleXpTimeLimitMs, doubleXpExpired } = get();
      const doubleXpClaimed = !!doubleXpTimeLimitMs && !doubleXpExpired;

      let res: InfiniteAnswerResponse & { meaningId?: number };

      if (currentQuestionSource === 'learning') {
        // Новый flow: /api/learning/answer.
        // Для свободного ввода (dictation/free-recall) — прокидываем
        // acceptableAnswers и partOfSpeech, чтобы сервер сам перевалидировал
        // через text-normalizer и не доверял слепо клиентскому isCorrect.
        const isFreeInput = currentQuestion.type === 'dictation' || currentQuestion.type === 'free-recall' || currentQuestion.type === 'cloze-input';
        const isDemo = get().demoMeaningId !== null;
        const learnRes = await learningAnswer({
          meaningId,
          isCorrect: computedIsCorrect,
          questionType: currentQuestion.type ?? 'multiple-choice',
          streak: get().streak,
          skip: isSkip,
          demo: isDemo || undefined,
          userAnswer,
          ...(isFreeInput ? {
            acceptableAnswers: currentQuestion.acceptableAnswers,
            partOfSpeech: currentQuestion.partOfSpeech,
          } : {}),
        });
        // Адаптер → совместимый InfiniteAnswerResponse для feedback panel.
        const correctTranslation = currentQuestion.type === 'encounter'
          ? currentQuestion.translation
          : ((currentQuestion as { correctTranslation?: string }).correctTranslation
            ?? (currentQuestion as { correctAnswer?: string }).correctAnswer
            ?? '');
        res = adaptLearningResponse(learnRes, meaningId, correctTranslation);
      } else {
        // Старый flow: /api/quiz/answer-infinite.
        res = await quizAnswerInfinite(meaningId, selectedMeaningId, get().streak, doubleXpClaimed, isSkip);
      }

      const updatedRecent = [...recentMeaningIds, meaningId].slice(-MAX_RECENT);
      const newStreak = res.isCorrect ? get().streak + 1 : 0;
      saveStreak(newStreak);

      // Обновляем LP в реальном времени
      if (res.totalLp !== undefined) {
        useLeagueStore.getState().updateLp(res.totalLp);
      }


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
      const livesUpdate: Partial<UnifiedGameState> = {};
      if (res.lives !== undefined) livesUpdate.lives = res.lives;
      if (res.livesRestoredAt !== undefined) livesUpdate.livesRestoredAt = res.livesRestoredAt ?? null;
      if (res.livesExhausted) livesUpdate.livesExhausted = true;

      set({
        feedback: { ...res, meaningId },
        currentQuestionSource: null, // сбросим до следующего fetchNext
        currentTier: null,
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

      // Автопереход к следующему вопросу (НЕ если жизни кончились).
      // Passive-recall сам управляет переходом (свой 500ms ✓/✗ overlay в
      // карточке + явный вызов fetchNext в submitPassiveRecall) — не запускаем
      // 1200ms таймер, иначе будет двойной fetchNext.
      const isPassiveRecall = currentQuestion.type === 'passive-recall';
      if (!res.livesExhausted && !isPassiveRecall) {
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
      const mpLivesUpdate: Partial<UnifiedGameState> = {};
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
    // Encounter не пропускается — он уже sub-action «Понятно»; просто игнорируем.
    if (currentQuestion.type === 'encounter') return;
    // Пропуск = ответ null (неправильно), без траты жизни
    await get().submitAnswer(null, undefined, true);
  },

  submitEncounter: async () => {
    const { currentQuestion } = get();
    if (!currentQuestion || currentQuestion.type !== 'encounter') return;
    // Encounter всегда «правильно» — это просто показ карточки.
    // submitAnswer определит isCorrect=true по question.type и пройдёт через learning-API.
    await get().submitAnswer(currentQuestion.meaningId, undefined, false);
  },

  submitPassiveRecall: async (knew: boolean) => {
    const { currentQuestion } = get();
    if (!currentQuestion || currentQuestion.type !== 'passive-recall') return;
    // knew=true → передаём meaningId (компарируется === meaningId → isCorrect=true).
    // knew=false → null (selectedMeaningId !== meaningId → isCorrect=false).
    // submitAnswer для passive-recall не ставит 1200ms-таймер, поэтому здесь
    // мы сами очищаем feedback и сразу подгружаем следующий вопрос.
    await get().submitAnswer(knew ? currentQuestion.meaningId : null, undefined, false);
    set({ feedback: null });
    await get().fetchNext();
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
      problemsMode: false,
      demoMeaningId: null,
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
