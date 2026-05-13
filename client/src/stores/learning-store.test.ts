/**
 * Тесты Zustand-store v2-flow. Без DOM, без сети — мочим `@/lib/api`.
 *
 * Покрывают:
 *   - fetchNext: успех / session_complete с reason / all_recent retry
 *   - submitAnswer (L0/L1/L2): запись ответа, обновление recentWordIds (окно 3), feedback timeout
 *   - submitGrade (L3): grade flow, моментальный fetchNext после grade
 *   - poolSwipe: swipe → fetchNext
 *   - anti-repeat: окно 3 wordId, не больше
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock API ДО импорта store
vi.mock('@/lib/api', () => ({
  learningNext: vi.fn(),
  learningAnswer: vi.fn(),
  learningSwipe: vi.fn(),
}));

// Mock league-store (он импортирует api, и для тестов нам не нужен реальный)
vi.mock('@/stores/league-store', () => ({
  useLeagueStore: {
    getState: () => ({ updateLp: vi.fn() }),
  },
}));

// Импортируем store после моков
import { useLearningStore } from './learning-store';
import { learningNext, learningAnswer, learningSwipe } from '@/lib/api';
import type {
  LearningNextResponse,
  LearningAnswerResponse,
  LearningSwipeResponse,
  QuizQuestion,
} from '@/types/api';

const mockNext = vi.mocked(learningNext);
const mockAnswer = vi.mocked(learningAnswer);
const mockSwipe = vi.mocked(learningSwipe);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePassiveQuestion(wordId: number, word = 'test'): QuizQuestion {
  return {
    type: 'passive-recall',
    meaningId: wordId * 100,
    wordId,
    word,
    translation: 'тест',
    example: null,
    mnemonic: null,
    meaningIndex: 1,
    totalMeanings: 1,
    meanings: [],
  };
}

function makeFreeRecallQuestion(wordId: number, word = 'test'): QuizQuestion {
  return {
    type: 'free-recall',
    meaningId: wordId * 100,
    wordId,
    direction: 'ru-en',
    prompt: 'тест',
    transcription: null,
    audioWord: word,
    acceptableAnswers: [word],
    partOfSpeech: 'phrase',
    meanings: [],
  };
}

function makePoolCardQuestion(wordId: number, word = 'test'): QuizQuestion {
  return {
    type: 'pool-card',
    meaningId: wordId * 100,
    wordId,
    word,
    transcription: null,
    partOfSpeech: 'phrase',
    meanings: [{
      meaningId: wordId * 100,
      translation: 'тест',
      example: null,
      partOfSpeech: 'phrase',
    }],
    example: null,
  };
}

function makeAnswerResponse(overrides: Partial<LearningAnswerResponse> = {}): LearningAnswerResponse {
  return {
    isCorrect: true,
    normalizedVia: null,
    tierBefore: 'passive',
    tierAfter: 'passive',
    wasAdvanced: false,
    wasReset: false,
    becameMastered: false,
    nextReviewAt: new Date().toISOString(),
    xpEarned: 10,
    lpEarned: 5,
    gemsEarned: 0,
    lives: 5,
    livesRestoredAt: null,
    livesExhausted: false,
    ...overrides,
  };
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Чистый store перед каждым тестом
  useLearningStore.getState().reset();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── fetchNext ──────────────────────────────────────────────────────────────

describe('fetchNext', () => {
  it('успех: сохраняет question, tier, wordId; обнуляет sessionComplete', async () => {
    const q = makePassiveQuestion(42);
    mockNext.mockResolvedValueOnce({
      question: q,
      tier: 'passive',
      wordId: 42,
    } as LearningNextResponse);

    await useLearningStore.getState().fetchNext();

    const state = useLearningStore.getState();
    expect(state.currentQuestion).toEqual(q);
    expect(state.currentTier).toBe('passive');
    expect(state.currentWordId).toBe(42);
    expect(state.sessionComplete).toBeNull();
    expect(state.isLoading).toBe(false);
  });

  it('session_complete с reason → сохраняет в sessionComplete state, не вызывает retry если reason !== all_recent', async () => {
    mockNext.mockResolvedValueOnce({
      mode: 'session_complete',
      reason: 'all_in_cooldown',
      nextDueAt: '2026-05-13T12:00:00.000Z',
      counts: { pool: 0, passive: 0, active: 0, review: 5, mastered: 2 },
    } as LearningNextResponse);

    await useLearningStore.getState().fetchNext();

    const state = useLearningStore.getState();
    expect(state.sessionComplete).not.toBeNull();
    expect(state.sessionComplete!.reason).toBe('all_in_cooldown');
    expect(state.sessionComplete!.counts.review).toBe(5);
    expect(state.currentQuestion).toBeNull();
    // mockNext дёрнут только 1 раз — нет retry
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('session_complete reason=all_recent → сбрасывает recentWordIds и retry', async () => {
    // Сначала наполняем recentWordIds через poolSwipe
    mockSwipe.mockResolvedValue({ ok: true } as LearningSwipeResponse);
    useLearningStore.setState({
      currentQuestion: makePoolCardQuestion(1),
      currentWordId: 1,
      currentTier: 'pool',
    });
    // Первый ответ: all_recent → должен сбросить exclude и retry
    const q = makePoolCardQuestion(2);
    mockNext
      .mockResolvedValueOnce({
        mode: 'session_complete',
        reason: 'all_recent',
        nextDueAt: null,
        counts: { pool: 3, passive: 0, active: 0, review: 0, mastered: 0 },
      } as LearningNextResponse)
      .mockResolvedValueOnce({
        question: q,
        tier: 'pool',
        wordId: 2,
      } as LearningNextResponse);

    // Накопим recentWordIds
    useLearningStore.setState({ recentWordIds: [1, 2, 3] });
    await useLearningStore.getState().fetchNext();

    expect(mockNext).toHaveBeenCalledTimes(2);
    const state = useLearningStore.getState();
    // После retry recentWordIds сброшены и пришёл вопрос
    expect(state.recentWordIds).toEqual([]);
    expect(state.currentQuestion).toEqual(q);
    expect(state.sessionComplete).toBeNull();
  });

  it('параллельный вызов: второй fetchNext не дёргает API пока isLoading=true', async () => {
    mockNext.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ question: makePassiveQuestion(1), tier: 'passive', wordId: 1 } as LearningNextResponse), 100),
        ),
    );

    const p1 = useLearningStore.getState().fetchNext();
    const p2 = useLearningStore.getState().fetchNext();
    vi.runAllTimers();
    await Promise.all([p1, p2]);

    // Только один запрос ушёл
    expect(mockNext).toHaveBeenCalledTimes(1);
  });
});

// ─── submitAnswer (L0/L1/L2) ────────────────────────────────────────────────

describe('submitAnswer', () => {
  it('на L1 passive: вызывает API, обновляет recentWordIds (окно 3), запускает таймер для fetchNext', async () => {
    // Setup: passive-карточка показана
    useLearningStore.setState({
      currentQuestion: makePassiveQuestion(10),
      currentWordId: 10,
      currentTier: 'passive',
    });

    mockAnswer.mockResolvedValueOnce(
      makeAnswerResponse({ isCorrect: true, tierBefore: 'passive', tierAfter: 'passive' }),
    );
    mockNext.mockResolvedValueOnce({
      question: makePassiveQuestion(11),
      tier: 'passive',
      wordId: 11,
    } as LearningNextResponse);

    await useLearningStore.getState().submitAnswer(true);

    expect(mockAnswer).toHaveBeenCalledWith(expect.objectContaining({
      wordId: 10,
      isCorrect: true,
      questionType: 'passive-recall',
    }));
    // recentWordIds обновился
    expect(useLearningStore.getState().recentWordIds).toContain(10);
    // Через 1200ms должен дёрнуть fetchNext
    expect(mockNext).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1300);
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('окно anti-repeat = 3: после 4 ответов в recentWordIds только последние 3', async () => {
    mockAnswer.mockResolvedValue(makeAnswerResponse());
    mockNext.mockResolvedValue({
      question: makePassiveQuestion(99),
      tier: 'passive',
      wordId: 99,
    } as LearningNextResponse);

    for (const wordId of [10, 20, 30, 40]) {
      useLearningStore.setState({
        currentQuestion: makePassiveQuestion(wordId),
        currentWordId: wordId,
        currentTier: 'passive',
      });
      await useLearningStore.getState().submitAnswer(true);
      await vi.advanceTimersByTimeAsync(1300);
    }

    const recent = useLearningStore.getState().recentWordIds;
    expect(recent).toEqual([20, 30, 40]);
    expect(recent.length).toBe(3);
  });

  it('на L3 review: НЕ работает (только submitGrade)', async () => {
    useLearningStore.setState({
      currentQuestion: makeFreeRecallQuestion(50),
      currentWordId: 50,
      currentTier: 'review',
    });

    await useLearningStore.getState().submitAnswer(true);

    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it('streak: правильный → +1, неправильный → сброс', async () => {
    useLearningStore.setState({
      currentQuestion: makePassiveQuestion(10),
      currentWordId: 10,
      currentTier: 'passive',
      streak: 4,
    });

    mockAnswer.mockResolvedValueOnce(makeAnswerResponse({ isCorrect: true }));
    mockNext.mockResolvedValue({ question: makePassiveQuestion(11), tier: 'passive', wordId: 11 } as LearningNextResponse);

    await useLearningStore.getState().submitAnswer(true);
    expect(useLearningStore.getState().streak).toBe(5);

    useLearningStore.setState({
      currentQuestion: makePassiveQuestion(11),
      currentWordId: 11,
      currentTier: 'passive',
    });
    mockAnswer.mockResolvedValueOnce(makeAnswerResponse({ isCorrect: false }));

    await useLearningStore.getState().submitAnswer(false);
    expect(useLearningStore.getState().streak).toBe(0);
  });
});

// ─── submitGrade (L3) ──────────────────────────────────────────────────────

describe('submitGrade', () => {
  it('grade=good: отправляет grade, моментально дёргает fetchNext (без таймера)', async () => {
    useLearningStore.setState({
      currentQuestion: makeFreeRecallQuestion(60, 'word'),
      currentWordId: 60,
      currentTier: 'review',
    });

    mockAnswer.mockResolvedValueOnce(makeAnswerResponse({
      tierBefore: 'review',
      tierAfter: 'review',
    }));
    mockNext.mockResolvedValueOnce({
      question: makeFreeRecallQuestion(61),
      tier: 'review',
      wordId: 61,
    } as LearningNextResponse);

    await useLearningStore.getState().submitGrade('good', 'word');

    expect(mockAnswer).toHaveBeenCalledWith(expect.objectContaining({
      wordId: 60,
      grade: 'good',
      userAnswer: 'word',
      acceptableAnswers: ['word'],
    }));
    // fetchNext вызван без ожидания 1.2с
    expect(mockNext).toHaveBeenCalled();
  });

  it('grade=again без userAnswer: стрик сбрасывается', async () => {
    useLearningStore.setState({
      currentQuestion: makeFreeRecallQuestion(60),
      currentWordId: 60,
      currentTier: 'review',
      streak: 5,
    });

    mockAnswer.mockResolvedValueOnce(makeAnswerResponse({
      isCorrect: false,
      tierBefore: 'review',
      tierAfter: 'active',
      wasReset: true,
    }));
    mockNext.mockResolvedValueOnce({
      question: makePassiveQuestion(61),
      tier: 'active',
      wordId: 61,
    } as LearningNextResponse);

    await useLearningStore.getState().submitGrade('again');

    expect(useLearningStore.getState().streak).toBe(0);
  });

  it('grade=good без userAnswer: считаем correct (доверие юзеру)', async () => {
    useLearningStore.setState({
      currentQuestion: makeFreeRecallQuestion(60),
      currentWordId: 60,
      currentTier: 'review',
      streak: 3,
    });

    // Сервер вернёт isCorrect=false (нет userAnswer для нормализации),
    // но клиент должен сам считать good как correct
    mockAnswer.mockResolvedValueOnce(makeAnswerResponse({
      isCorrect: false,
      tierBefore: 'review',
      tierAfter: 'review',
    }));
    mockNext.mockResolvedValueOnce({
      question: makePassiveQuestion(61),
      tier: 'review',
      wordId: 61,
    } as LearningNextResponse);

    await useLearningStore.getState().submitGrade('good');

    // Стрик увеличился, т.к. (userAnswer===undefined && grade!=='again') → wasCorrect=true
    expect(useLearningStore.getState().streak).toBe(4);
  });
});

// ─── poolSwipe (L0) ────────────────────────────────────────────────────────

describe('poolSwipe', () => {
  it('learn: вызывает API, добавляет в recentWordIds, дёргает fetchNext', async () => {
    useLearningStore.setState({
      currentQuestion: makePoolCardQuestion(70),
      currentWordId: 70,
      currentTier: 'pool',
    });

    mockSwipe.mockResolvedValueOnce({ ok: true } as LearningSwipeResponse);
    mockNext.mockResolvedValueOnce({
      question: makePassiveQuestion(71),
      tier: 'passive',
      wordId: 71,
    } as LearningNextResponse);

    await useLearningStore.getState().poolSwipe('learn');

    expect(mockSwipe).toHaveBeenCalledWith({ wordId: 70, action: 'learn' });
    expect(useLearningStore.getState().recentWordIds).toContain(70);
    expect(mockNext).toHaveBeenCalled();
  });

  it('know / snooze: тоже работают', async () => {
    for (const action of ['know', 'snooze'] as const) {
      useLearningStore.setState({
        currentQuestion: makePoolCardQuestion(80),
        currentWordId: 80,
        currentTier: 'pool',
      });
      mockSwipe.mockResolvedValueOnce({ ok: true } as LearningSwipeResponse);
      mockNext.mockResolvedValueOnce({
        question: makePassiveQuestion(81),
        tier: 'passive',
        wordId: 81,
      } as LearningNextResponse);

      await useLearningStore.getState().poolSwipe(action);
      expect(mockSwipe).toHaveBeenLastCalledWith({ wordId: 80, action });
    }
  });
});

// ─── Регрессия багов ───────────────────────────────────────────────────────

describe('Регрессии', () => {
  it('fetchNext обнуляет sessionComplete на старте (defensive)', async () => {
    // Симуляция: sessionComplete=true из прошлого запроса, теперь fetchNext должен очистить
    useLearningStore.setState({
      sessionComplete: {
        mode: 'session_complete',
        reason: 'collection_exhausted',
        nextDueAt: null,
        counts: { pool: 0, passive: 0, active: 0, review: 0, mastered: 0 },
      },
    });

    mockNext.mockResolvedValueOnce({
      question: makePassiveQuestion(1),
      tier: 'passive',
      wordId: 1,
    } as LearningNextResponse);

    await useLearningStore.getState().fetchNext();

    expect(useLearningStore.getState().sessionComplete).toBeNull();
    expect(useLearningStore.getState().currentQuestion).not.toBeNull();
  });

  it('setCollectionId сбрасывает recentWordIds, currentQuestion, sessionComplete', () => {
    useLearningStore.setState({
      recentWordIds: [1, 2, 3],
      currentQuestion: makePassiveQuestion(10),
      currentTier: 'passive',
      currentWordId: 10,
      sessionComplete: {
        mode: 'session_complete',
        reason: 'no_words',
        nextDueAt: null,
        counts: { pool: 0, passive: 0, active: 0, review: 0, mastered: 0 },
      },
    });

    useLearningStore.getState().setCollectionId(42);

    const s = useLearningStore.getState();
    expect(s.collectionId).toBe(42);
    expect(s.recentWordIds).toEqual([]);
    expect(s.currentQuestion).toBeNull();
    expect(s.sessionComplete).toBeNull();
  });
});
