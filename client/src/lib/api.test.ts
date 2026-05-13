/**
 * Тесты learning-API функций: правильное формирование URL и тела.
 * Мочим global fetch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { learningNext, learningAnswer, learningSwipe } from './api';

const mockFetch = vi.fn();
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ ok: true }),
  });
  localStorage.clear();
  localStorage.setItem('wordy_token', 'fake-jwt');
});

function getCallUrl(): string {
  return mockFetch.mock.calls[0]![0] as string;
}

describe('learningNext', () => {
  it('без параметров: GET /api/learning/next без query', async () => {
    await learningNext();
    const url = getCallUrl();
    expect(url).toMatch(/\/api\/learning\/next$/);
  });

  it('с collectionId: ?collectionId=30', async () => {
    await learningNext({ collectionId: 30 });
    expect(getCallUrl()).toContain('collectionId=30');
  });

  it('с excludeWordIds: ?excludeWordIds=10,20,30', async () => {
    await learningNext({ excludeWordIds: [10, 20, 30] });
    expect(getCallUrl()).toContain('excludeWordIds=10%2C20%2C30');
  });

  it('пустой excludeWordIds — не добавляется в query', async () => {
    await learningNext({ excludeWordIds: [] });
    expect(getCallUrl()).not.toContain('excludeWordIds');
  });

  it('JWT добавляется в Authorization', async () => {
    await learningNext();
    const opts = mockFetch.mock.calls[0]![1] as RequestInit;
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer fake-jwt');
  });
});

describe('learningAnswer', () => {
  it('POST /api/learning/answer с body', async () => {
    await learningAnswer({
      wordId: 42,
      isCorrect: true,
      questionType: 'passive-recall',
      streak: 3,
    });
    const url = getCallUrl();
    const opts = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(url).toMatch(/\/api\/learning\/answer$/);
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body as string);
    expect(body).toEqual({
      wordId: 42,
      isCorrect: true,
      questionType: 'passive-recall',
      streak: 3,
    });
  });

  it('с grade (L3)', async () => {
    await learningAnswer({ wordId: 1, grade: 'good', userAnswer: 'house' });
    const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
    expect(body.grade).toBe('good');
    expect(body.userAnswer).toBe('house');
  });
});

describe('learningSwipe', () => {
  it('POST /api/learning/swipe', async () => {
    await learningSwipe({ wordId: 7, action: 'learn' });
    const opts = mockFetch.mock.calls[0]![1] as RequestInit;
    expect(getCallUrl()).toMatch(/\/api\/learning\/swipe$/);
    expect(opts.method).toBe('POST');
    const body = JSON.parse(opts.body as string);
    expect(body).toEqual({ wordId: 7, action: 'learn' });
  });

  it('action=know / snooze / learn — все принимаются', async () => {
    for (const action of ['know', 'learn', 'snooze'] as const) {
      mockFetch.mockClear();
      await learningSwipe({ wordId: 1, action });
      const body = JSON.parse(mockFetch.mock.calls[0]![1]!.body as string);
      expect(body.action).toBe(action);
    }
  });
});
