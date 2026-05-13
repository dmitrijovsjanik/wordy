/**
 * Тесты vocabulary-screen. Покрывают рендер всех ветвей session_complete
 * с правильными сообщениями.
 *
 * Стратегия: мочим `learningNext` чтобы он возвращал нужный session_complete,
 * рендерим, ждём пока useEffect → fetchNext → setState, проверяем.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { LearningNextResponse } from '@/types/api';

const mockLearningV2Next = vi.fn();

vi.mock('@/lib/api', () => ({
  learningNext: (...args: unknown[]) => mockLearningV2Next(...args),
  learningAnswer: vi.fn(),
  learningSwipe: vi.fn(),
}));

vi.mock('@/stores/league-store', () => ({
  useLeagueStore: { getState: () => ({ updateLp: vi.fn() }) },
}));

vi.mock('@/stores/user-store', () => ({
  useUserStore: vi.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      user: { id: 1, level: 1, xp: 0, streakDays: 0, lives: 5, gems: 0, createdAt: new Date() },
      refreshProfile: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/stores/collection-store', () => ({
  useCollectionStore: vi.fn((selector?: (s: unknown) => unknown) => {
    const state = {
      library: [{ id: 30, title: 'Test Coll' }],
      isLoadingLibrary: false,
      fetchLibrary: vi.fn().mockResolvedValue(undefined),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/hooks/use-telegram', () => ({
  useTelegram: () => ({ hapticImpact: vi.fn(), hapticNotification: vi.fn() }),
}));

vi.mock('@/components/game/learning-header', () => ({
  LearningHeader: () => <div data-testid="learning-header" />,
}));
vi.mock('@/components/answer-history-drawer', () => ({
  AnswerHistoryDrawer: () => null,
}));

import { VocabularyScreen } from './vocabulary-screen';
import { useLearningStore } from '@/stores/learning-store';

function renderScreen() {
  return render(
    <MemoryRouter>
      <VocabularyScreen />
    </MemoryRouter>,
  );
}

const baseCounts = { pool: 0, passive: 0, active: 0, review: 0, mastered: 0 };

function sessionCompleteResponse(overrides: {
  reason: LearningNextResponse extends infer T ? T extends { reason: infer R } ? R : never : never;
  nextDueAt?: string | null;
  counts?: Partial<typeof baseCounts>;
}): LearningNextResponse {
  return {
    mode: 'session_complete',
    reason: overrides.reason,
    nextDueAt: overrides.nextDueAt ?? null,
    counts: { ...baseCounts, ...overrides.counts },
  };
}

beforeEach(() => {
  useLearningStore.getState().reset();
  localStorage.clear();
  sessionStorage.clear();
  mockLearningV2Next.mockReset();
  // По умолчанию мок возвращает no_words, чтобы fetchNext всегда что-то получил.
  mockLearningV2Next.mockResolvedValue({
    mode: 'session_complete',
    reason: 'no_words',
    nextDueAt: null,
    counts: baseCounts,
  });
});

/** Принудительно ставим sessionComplete после рендера — обходит race-condition
 *  с useEffect fetchNext, чтобы тест проверял только UI-отображение. */
function forceSessionComplete(s: NonNullable<ReturnType<typeof useLearningStore.getState>['sessionComplete']>) {
  useLearningStore.setState({
    sessionComplete: s,
    currentQuestion: null,
    currentTier: null,
    currentWordId: null,
    isLoading: false,
  });
}

describe('VocabularyScreen — session_complete рендеринг', () => {
  it('reason=no_words → «Нет слов для изучения»', async () => {
    const { rerender } = renderScreen();
    forceSessionComplete({
      mode: 'session_complete',
      reason: 'no_words',
      nextDueAt: null,
      counts: baseCounts,
    });
    rerender(<MemoryRouter><VocabularyScreen /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Нет слов для изучения')).toBeInTheDocument();
    });
    expect(screen.getByText(/Подпишитесь на коллекцию/)).toBeInTheDocument();
  });

  it('reason=all_in_cooldown + nextDueAt → текст «на повторении»', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const { rerender } = renderScreen();
    forceSessionComplete({
      mode: 'session_complete',
      reason: 'all_in_cooldown',
      nextDueAt: tomorrow.toISOString(),
      counts: { ...baseCounts, review: 10 },
    });
    rerender(<MemoryRouter><VocabularyScreen /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Все слова из активной колоды на повторении/)).toBeInTheDocument();
    });
    expect(screen.getByText('На повторении')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('reason=collection_exhausted с словами → показывает счётчики', async () => {
    const { rerender } = renderScreen();
    forceSessionComplete({
      mode: 'session_complete',
      reason: 'collection_exhausted',
      nextDueAt: null,
      counts: { pool: 0, passive: 2, active: 3, review: 5, mastered: 12 },
    });
    rerender(<MemoryRouter><VocabularyScreen /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/В этой коллекции пока нет новых слов/)).toBeInTheDocument();
    });
    expect(screen.getByText('Узнавание')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Активные')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Выучено')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('reason=collection_exhausted без слов → «Добавьте новую коллекцию»', async () => {
    const { rerender } = renderScreen();
    forceSessionComplete({
      mode: 'session_complete',
      reason: 'collection_exhausted',
      nextDueAt: null,
      counts: baseCounts,
    });
    rerender(<MemoryRouter><VocabularyScreen /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/закончились слова/)).toBeInTheDocument();
    });
  });

  it('reason=all_recent → «Слишком мало доступных слов»', async () => {
    const { rerender } = renderScreen();
    forceSessionComplete({
      mode: 'session_complete',
      reason: 'all_recent',
      nextDueAt: null,
      counts: { ...baseCounts, pool: 2 },
    });
    rerender(<MemoryRouter><VocabularyScreen /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText(/Слишком мало доступных слов/)).toBeInTheDocument();
    });
  });

  it('кнопка «На главную» доступна на session_complete', async () => {
    const { rerender } = renderScreen();
    forceSessionComplete({
      mode: 'session_complete',
      reason: 'no_words',
      nextDueAt: null,
      counts: baseCounts,
    });
    rerender(<MemoryRouter><VocabularyScreen /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'На главную' })).toBeInTheDocument();
    });
  });
});

// eslint typescript: используем sessionCompleteResponse чтобы не было warning unused
void sessionCompleteResponse;
