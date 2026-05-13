import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeNextReview, LEARNED_PROGRESS } from './srs-service.js';

// Constants mirrored from srs-service.ts. Kept local so tests fail loudly if
// the source constants drift from current behavior.
const LEARNING_INTERVALS_HOURS = [4, 8];
const REVIEW_INTERVALS_DAYS = [3, 7, 21, 60, 180];
const WRONG_ANSWER_COOLDOWN_MIN = 30;
const WRONG_REVIEW_RESET_DAYS = 1;

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

// Frozen "now" used for deterministic interval assertions.
const FROZEN_NOW = new Date('2026-01-01T12:00:00.000Z');

type SrsState = {
  learningProgress: number;
  hasPenalty: boolean;
  reviewStage: number;
};

function state(
  learningProgress: number,
  hasPenalty: boolean,
  reviewStage: number,
): SrsState {
  return { learningProgress, hasPenalty, reviewStage };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FROZEN_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('LEARNED_PROGRESS exported constant', () => {
  it('is 3', () => {
    expect(LEARNED_PROGRESS).toBe(3);
  });
});

describe('computeNextReview — learning phase, wrong answer', () => {
  // Wrong answer in learning phase: hasPenalty=true, 30-min cooldown,
  // progress unchanged, reviewStage forced to 0, isLearned=false.
  // Branch should not depend on existing hasPenalty or reviewStage values.
  const cases: Array<[number, boolean, number]> = [
    [0, false, 0],
    [0, true, 0],
    [1, false, 0],
    [1, true, 0],
    [2, false, 0],
    [2, true, 0],
    // reviewStage > 0 is nonsensical for learning phase, but the function
    // should still normalize to 0.
    [0, false, 3],
    [2, true, 4],
  ];

  it.each(cases)(
    'progress=%i hasPenalty=%s reviewStage=%i + wrong → cooldown 30m, penalty set',
    (progress, hasPenalty, reviewStage) => {
      const result = computeNextReview(state(progress, hasPenalty, reviewStage), false);

      expect(result.newProgress).toBe(progress);
      expect(result.newPenalty).toBe(true);
      expect(result.newReviewStage).toBe(0);
      expect(result.isLearned).toBe(false);
      expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
        WRONG_ANSWER_COOLDOWN_MIN * MIN_MS,
      );
    },
  );
});

describe('computeNextReview — learning phase, correct WITH penalty active', () => {
  // Correct answer while penalty is active clears the penalty,
  // does NOT advance progress, schedules next at LEARNING_INTERVALS_HOURS[
  // min(progress, len-1)], reviewStage stays 0, isLearned=false.
  const cases: Array<[number, number]> = [
    [0, LEARNING_INTERVALS_HOURS[0]!], // index 0 → 4h
    [1, LEARNING_INTERVALS_HOURS[1]!], // index 1 → 8h
    [2, LEARNING_INTERVALS_HOURS[1]!], // clamped to len-1=1 → 8h
  ];

  it.each(cases)(
    'progress=%i + correct + hasPenalty → clears penalty, %ih, no progress change',
    (progress, expectedHours) => {
      const result = computeNextReview(state(progress, true, 0), true);

      expect(result.newProgress).toBe(progress);
      expect(result.newPenalty).toBe(false);
      expect(result.newReviewStage).toBe(0);
      expect(result.isLearned).toBe(false);
      expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
        expectedHours * HOUR_MS,
      );
    },
  );
});

describe('computeNextReview — learning phase, correct WITHOUT penalty', () => {
  // Correct without penalty advances progress by 1 and uses
  // LEARNING_INTERVALS_HOURS[min(state.learningProgress, len-1)]
  // (note: indexed by OLD progress, not new progress).
  it('progress 0 → 1, 4h interval', () => {
    const result = computeNextReview(state(0, false, 0), true);

    expect(result.newProgress).toBe(1);
    expect(result.newPenalty).toBe(false);
    expect(result.newReviewStage).toBe(0);
    expect(result.isLearned).toBe(false);
    expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
      LEARNING_INTERVALS_HOURS[0]! * HOUR_MS,
    );
  });

  it('progress 1 → 2, 8h interval', () => {
    const result = computeNextReview(state(1, false, 0), true);

    expect(result.newProgress).toBe(2);
    expect(result.newPenalty).toBe(false);
    expect(result.newReviewStage).toBe(0);
    expect(result.isLearned).toBe(false);
    expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
      LEARNING_INTERVALS_HOURS[1]! * HOUR_MS,
    );
  });

  it('progress 2 → 3 (LEARNED), 3-day interval, isLearned=true', () => {
    const result = computeNextReview(state(2, false, 0), true);

    expect(result.newProgress).toBe(LEARNED_PROGRESS);
    expect(result.newPenalty).toBe(false);
    expect(result.newReviewStage).toBe(0);
    expect(result.isLearned).toBe(true);
    expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
      REVIEW_INTERVALS_DAYS[0]! * DAY_MS,
    );
  });

  it('progress 2 → 3 (LEARNED) — reviewStage in input is ignored, output reviewStage=0', () => {
    const result = computeNextReview(state(2, false, 4), true);

    expect(result.newReviewStage).toBe(0);
    expect(result.isLearned).toBe(true);
  });
});

describe('computeNextReview — review phase, wrong answer', () => {
  // Wrong on review: progress stays at 3, penalty stays false,
  // reviewStage resets to 0, 1-day cooldown, isLearned=false.
  const reviewStages = [0, 1, 2, 3, 4];

  it.each(reviewStages)(
    'reviewStage=%i + wrong → reset reviewStage=0, 1-day cooldown',
    (reviewStage) => {
      const result = computeNextReview(state(LEARNED_PROGRESS, false, reviewStage), false);

      expect(result.newProgress).toBe(LEARNED_PROGRESS);
      expect(result.newPenalty).toBe(false);
      expect(result.newReviewStage).toBe(0);
      expect(result.isLearned).toBe(false);
      expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
        WRONG_REVIEW_RESET_DAYS * DAY_MS,
      );
    },
  );

  it('hasPenalty=true on review + wrong → penalty cleared (set to false)', () => {
    // Review-phase branch ignores incoming penalty and emits newPenalty=false.
    const result = computeNextReview(state(LEARNED_PROGRESS, true, 2), false);

    expect(result.newPenalty).toBe(false);
  });
});

describe('computeNextReview — review phase, correct answer', () => {
  // Correct on review: advances reviewStage by 1 (clamped to len-1),
  // interval = REVIEW_INTERVALS_DAYS[nextReviewStage], isLearned=false.
  // NOTE: nextReviewStage = min(reviewStage+1, 4). This means when
  // a freshly-learned meaning (reviewStage=0) gets its first correct
  // review, it jumps to stage 1 (7 days), effectively skipping stage 0
  // (3 days) — the 3-day delay was the initial post-learning gap.
  const cases: Array<[number, number, number]> = [
    [0, 1, REVIEW_INTERVALS_DAYS[1]!], // 0 → 1, 7 days
    [1, 2, REVIEW_INTERVALS_DAYS[2]!], // 1 → 2, 21 days
    [2, 3, REVIEW_INTERVALS_DAYS[3]!], // 2 → 3, 60 days
    [3, 4, REVIEW_INTERVALS_DAYS[4]!], // 3 → 4, 180 days
    [4, 4, REVIEW_INTERVALS_DAYS[4]!], // clamped at 4, stays 180 days
  ];

  it.each(cases)(
    'reviewStage=%i + correct → newReviewStage=%i, %i days',
    (reviewStage, expectedNewStage, expectedDays) => {
      const result = computeNextReview(state(LEARNED_PROGRESS, false, reviewStage), true);

      expect(result.newProgress).toBe(LEARNED_PROGRESS);
      expect(result.newPenalty).toBe(false);
      expect(result.newReviewStage).toBe(expectedNewStage);
      // Current code returns isLearned=false on correct review (the flag is
      // only true on the initial learning→review transition). Capturing
      // current behavior — task spec hinted otherwise but source wins.
      expect(result.isLearned).toBe(false);
      expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
        expectedDays * DAY_MS,
      );
    },
  );

  it('hasPenalty=true on review + correct → penalty cleared, advances normally', () => {
    const result = computeNextReview(state(LEARNED_PROGRESS, true, 1), true);

    expect(result.newPenalty).toBe(false);
    expect(result.newReviewStage).toBe(2);
    expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
      REVIEW_INTERVALS_DAYS[2]! * DAY_MS,
    );
  });

  it('reviewStage clamping: max stage stays at array end (no overflow)', () => {
    const result = computeNextReview(state(LEARNED_PROGRESS, false, 4), true);

    expect(result.newReviewStage).toBe(4);
    expect(result.nextReviewAt.getTime() - FROZEN_NOW.getTime()).toBe(
      REVIEW_INTERVALS_DAYS[4]! * DAY_MS,
    );
  });
});

describe('computeNextReview — isLearned semantics', () => {
  // isLearned should be true ONLY on the 2→3 transition (first time
  // reaching LEARNED_PROGRESS from learning phase). All other paths false.
  it('false on wrong learning answer', () => {
    expect(computeNextReview(state(2, false, 0), false).isLearned).toBe(false);
  });

  it('false on correct-with-penalty learning answer (no progress change)', () => {
    expect(computeNextReview(state(2, true, 0), true).isLearned).toBe(false);
  });

  it('true on correct, no penalty, progress 2 → 3', () => {
    expect(computeNextReview(state(2, false, 0), true).isLearned).toBe(true);
  });

  it('false on correct, no penalty, progress 0 → 1', () => {
    expect(computeNextReview(state(0, false, 0), true).isLearned).toBe(false);
  });

  it('false on correct, no penalty, progress 1 → 2', () => {
    expect(computeNextReview(state(1, false, 0), true).isLearned).toBe(false);
  });

  it('false on wrong review (already learned)', () => {
    expect(computeNextReview(state(LEARNED_PROGRESS, false, 2), false).isLearned).toBe(false);
  });

  it('false on correct review (already learned)', () => {
    expect(computeNextReview(state(LEARNED_PROGRESS, false, 2), true).isLearned).toBe(false);
  });
});

describe('computeNextReview — output type/shape', () => {
  it('returns a Date for nextReviewAt', () => {
    const result = computeNextReview(state(0, false, 0), true);
    expect(result.nextReviewAt).toBeInstanceOf(Date);
  });

  it('result has all expected keys', () => {
    const result = computeNextReview(state(0, false, 0), true);
    expect(Object.keys(result).sort()).toEqual(
      ['isLearned', 'newPenalty', 'newProgress', 'newReviewStage', 'nextReviewAt'].sort(),
    );
  });
});
