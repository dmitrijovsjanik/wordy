import { describe, it, expect } from 'vitest';
import { computeTransition, type TierTransitionInput } from './learning-service.js';
import { learningConfig } from '../config/learning-config.js';
import type { LearningTier } from './analytics-service.js';

// Frozen "now" used for deterministic interval assertions.
// All transitions are tested against this fixed point — the function under
// test is pure and accepts `now` explicitly.
const NOW = new Date('2026-01-01T00:00:00.000Z');

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

// ─── Local helpers ──────────────────────────────────────────────────────────

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * MIN_MS);
}
function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * HOUR_MS);
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function input(
  tier: LearningTier,
  tierCorrectCount: number,
  reviewStage: number,
  isCorrect: boolean,
  hasPenalty = false,
): TierTransitionInput {
  return { tier, tierCorrectCount, reviewStage, hasPenalty, isCorrect };
}

// Convenience accessors for the config so that tests fail loudly if config
// shifts but assertions go stale.
const COOLDOWN_MIN = learningConfig.intervals.learningCooldownMinutes;
const ENC_TO_PASSIVE_H = learningConfig.intervals.encounterToPassiveHours;
const LEARN_HOURS = learningConfig.intervals.learningIntervalsHours;
const REVIEW_DAYS = learningConfig.intervals.reviewIntervalsDays;
const REVIEW_WRONG_TIER = learningConfig.intervals.reviewWrongRollbackTier;
const REVIEW_WRONG_DAYS = learningConfig.intervals.reviewWrongCooldownDays;

// ─── encounter ──────────────────────────────────────────────────────────────

describe('computeTransition — encounter', () => {
  // Encounter is just a "card shown" tier. Per the source, ANY answer
  // (correct or wrong) advances to passive with the same schedule. The
  // function does not branch on isCorrect for tier='encounter'.
  it.each([true, false])(
    'isCorrect=%s → advances to passive, count=0, scheduled %ih ahead',
    (isCorrect) => {
      const result = computeTransition(input('encounter', 0, 0, isCorrect), NOW);

      expect(result.tier).toBe('passive');
      expect(result.tierCorrectCount).toBe(0);
      expect(result.reviewStage).toBe(0);
      expect(result.hasPenalty).toBe(false);
      expect(result.becameLearned).toBe(false);
      expect(result.wasReset).toBe(false);
      expect(result.wasAdvanced).toBe(true);
      expect(result.nextReviewAt.getTime()).toBe(
        addHours(NOW, ENC_TO_PASSIVE_H).getTime(),
      );
    },
  );

  it('ignores tierCorrectCount and reviewStage in input', () => {
    const result = computeTransition(input('encounter', 5, 7, true), NOW);
    expect(result.tier).toBe('passive');
    expect(result.tierCorrectCount).toBe(0);
    expect(result.reviewStage).toBe(0);
  });

  it('ignores hasPenalty=true in input (output penalty is false)', () => {
    const result = computeTransition(input('encounter', 0, 0, true, true), NOW);
    expect(result.hasPenalty).toBe(false);
  });
});

// ─── passive ────────────────────────────────────────────────────────────────

describe('computeTransition — passive, wrong answer', () => {
  // Wrong answer in learning phase (passive/active): no tier rollback, just
  // reset count to 0 and apply 30-min cooldown with hasPenalty=true.
  const cases: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    // reviewStage in input is irrelevant for non-review tiers; output is 0.
    [0, 3],
  ];

  it.each(cases)(
    'count=%i reviewStage=%i + wrong → stays passive, cooldown %im',
    (count, reviewStage) => {
      const result = computeTransition(input('passive', count, reviewStage, false), NOW);

      expect(result.tier).toBe('passive');
      expect(result.tierCorrectCount).toBe(0);
      expect(result.reviewStage).toBe(0);
      expect(result.hasPenalty).toBe(true);
      expect(result.becameLearned).toBe(false);
      expect(result.wasReset).toBe(false);
      expect(result.wasAdvanced).toBe(false);
      expect(result.nextReviewAt.getTime()).toBe(
        addMinutes(NOW, COOLDOWN_MIN).getTime(),
      );
    },
  );
});

describe('computeTransition — passive, correct answer', () => {
  // correctToAdvance for passive is 2. Path:
  //   count=0 + correct → count=1, stays passive, scheduled at LEARN_HOURS[1]
  //     (because newCount=1 is used as index, clamped to len-1=1).
  //   count=1 + correct → newCount=2 ≥ 2 → advances to active, count=0,
  //     scheduled at LEARN_HOURS[0] (4h).
  it('count=0 + correct → count=1, stays passive, scheduled at LEARN_HOURS[1]', () => {
    const result = computeTransition(input('passive', 0, 0, true), NOW);

    expect(result.tier).toBe('passive');
    expect(result.tierCorrectCount).toBe(1);
    expect(result.reviewStage).toBe(0);
    expect(result.hasPenalty).toBe(false);
    expect(result.becameLearned).toBe(false);
    expect(result.wasReset).toBe(false);
    expect(result.wasAdvanced).toBe(false);
    // newCount=1, idx=min(1, 1)=1 → LEARN_HOURS[1] (8h).
    expect(result.nextReviewAt.getTime()).toBe(
      addHours(NOW, LEARN_HOURS[1]!).getTime(),
    );
  });

  it('count=1 + correct → advances to active, count=0, scheduled at LEARN_HOURS[0]', () => {
    const result = computeTransition(input('passive', 1, 0, true), NOW);

    expect(result.tier).toBe('active');
    expect(result.tierCorrectCount).toBe(0);
    expect(result.reviewStage).toBe(0);
    expect(result.hasPenalty).toBe(false);
    expect(result.becameLearned).toBe(false);
    expect(result.wasReset).toBe(false);
    expect(result.wasAdvanced).toBe(true);
    expect(result.nextReviewAt.getTime()).toBe(
      addHours(NOW, LEARN_HOURS[0]!).getTime(),
    );
  });

  it('count above correctToAdvance still triggers advance (defensive)', () => {
    // newCount = 3 >= 2 → advances. This shouldn't happen in practice but
    // verifies the >= comparison, not strict equality.
    const result = computeTransition(input('passive', 2, 0, true), NOW);
    expect(result.tier).toBe('active');
    expect(result.wasAdvanced).toBe(true);
  });

  it('reviewStage in input is ignored on passive correct (output reviewStage=0)', () => {
    const result = computeTransition(input('passive', 0, 4, true), NOW);
    expect(result.reviewStage).toBe(0);
  });
});

// ─── active ─────────────────────────────────────────────────────────────────

describe('computeTransition — active, wrong answer', () => {
  it.each([0, 1])(
    'count=%i + wrong → stays active, cooldown 30m, penalty set',
    (count) => {
      const result = computeTransition(input('active', count, 0, false), NOW);

      expect(result.tier).toBe('active');
      expect(result.tierCorrectCount).toBe(0);
      expect(result.reviewStage).toBe(0);
      expect(result.hasPenalty).toBe(true);
      expect(result.becameLearned).toBe(false);
      expect(result.wasReset).toBe(false);
      expect(result.wasAdvanced).toBe(false);
      expect(result.nextReviewAt.getTime()).toBe(
        addMinutes(NOW, COOLDOWN_MIN).getTime(),
      );
    },
  );
});

describe('computeTransition — active, correct answer', () => {
  // correctToAdvance for active is 2. Path:
  //   count=0 + correct → count=1, stays active, LEARN_HOURS[1] (8h).
  //   count=1 + correct → newCount=2 ≥ 2 → advances. Since
  //     production.enabled=false (current default), goes straight to review,
  //     reviewStage=0, becameLearned=true, scheduled REVIEW_DAYS[0] days ahead.
  it('count=0 + correct → count=1, stays active, scheduled at LEARN_HOURS[1]', () => {
    const result = computeTransition(input('active', 0, 0, true), NOW);

    expect(result.tier).toBe('active');
    expect(result.tierCorrectCount).toBe(1);
    expect(result.reviewStage).toBe(0);
    expect(result.hasPenalty).toBe(false);
    expect(result.becameLearned).toBe(false);
    expect(result.wasAdvanced).toBe(false);
    expect(result.nextReviewAt.getTime()).toBe(
      addHours(NOW, LEARN_HOURS[1]!).getTime(),
    );
  });

  it('count=1 + correct → advances to review, becameLearned=true, REVIEW_DAYS[0]', () => {
    // NOTE: This branch depends on learningConfig.tiers.production.enabled.
    // When production.enabled becomes true, behavior changes (advances to
    // production, not review, and becameLearned=false). Today we assert
    // current behavior with production disabled.
    // TODO(production-enabled): when production.enabled flips to true, add
    // a sibling case asserting tier='production' and update this one.
    expect(learningConfig.tiers.production.enabled).toBe(false);

    const result = computeTransition(input('active', 1, 0, true), NOW);

    expect(result.tier).toBe('review');
    expect(result.tierCorrectCount).toBe(0);
    expect(result.reviewStage).toBe(0);
    expect(result.hasPenalty).toBe(false);
    expect(result.becameLearned).toBe(true);
    expect(result.wasReset).toBe(false);
    expect(result.wasAdvanced).toBe(true);
    expect(result.nextReviewAt.getTime()).toBe(
      addDays(NOW, REVIEW_DAYS[0]!).getTime(),
    );
  });

  it('count above correctToAdvance still triggers review jump', () => {
    const result = computeTransition(input('active', 2, 0, true), NOW);
    expect(result.tier).toBe('review');
    expect(result.becameLearned).toBe(true);
  });

  it('reviewStage in input is ignored on active correct (output reviewStage=0)', () => {
    const result = computeTransition(input('active', 1, 3, true), NOW);
    expect(result.reviewStage).toBe(0);
  });
});

// ─── production ─────────────────────────────────────────────────────────────

describe('computeTransition — production, wrong answer', () => {
  // Production tier is currently disabled in entry-point logic, but
  // computeTransition itself does not check `enabled` for input.tier and
  // therefore handles 'production' deterministically. We test the branch.
  it.each([0, 1, 2])(
    'count=%i + wrong → stays production, cooldown 30m, penalty set',
    (count) => {
      const result = computeTransition(input('production', count, 0, false), NOW);

      expect(result.tier).toBe('production');
      expect(result.tierCorrectCount).toBe(0);
      expect(result.reviewStage).toBe(0);
      expect(result.hasPenalty).toBe(true);
      expect(result.becameLearned).toBe(false);
      expect(result.wasReset).toBe(false);
      expect(result.wasAdvanced).toBe(false);
      expect(result.nextReviewAt.getTime()).toBe(
        addMinutes(NOW, COOLDOWN_MIN).getTime(),
      );
    },
  );
});

describe('computeTransition — production, correct answer', () => {
  // correctToAdvance for production is 3. Path:
  //   count=0 → count=1, stays production, LEARN_HOURS[min(1,1)] = LEARN_HOURS[1] (8h)
  //   count=1 → count=2, stays production, LEARN_HOURS[min(2,1)] = LEARN_HOURS[1] (8h, clamped)
  //   count=2 → newCount=3 ≥ 3 → advances to review, becameLearned=true.
  it('count=0 + correct → count=1, stays production, LEARN_HOURS[1]', () => {
    const result = computeTransition(input('production', 0, 0, true), NOW);

    expect(result.tier).toBe('production');
    expect(result.tierCorrectCount).toBe(1);
    expect(result.reviewStage).toBe(0);
    expect(result.hasPenalty).toBe(false);
    expect(result.becameLearned).toBe(false);
    expect(result.wasAdvanced).toBe(false);
    expect(result.nextReviewAt.getTime()).toBe(
      addHours(NOW, LEARN_HOURS[1]!).getTime(),
    );
  });

  it('count=1 + correct → count=2, stays production, LEARN_HOURS[1] (clamped)', () => {
    // newCount=2, idx=min(2, len-1=1)=1 → LEARN_HOURS[1] (8h).
    const result = computeTransition(input('production', 1, 0, true), NOW);

    expect(result.tier).toBe('production');
    expect(result.tierCorrectCount).toBe(2);
    expect(result.reviewStage).toBe(0);
    expect(result.hasPenalty).toBe(false);
    expect(result.wasAdvanced).toBe(false);
    expect(result.nextReviewAt.getTime()).toBe(
      addHours(NOW, LEARN_HOURS[1]!).getTime(),
    );
  });

  it('count=2 + correct → advances to review, becameLearned=true, REVIEW_DAYS[0]', () => {
    const result = computeTransition(input('production', 2, 0, true), NOW);

    expect(result.tier).toBe('review');
    expect(result.tierCorrectCount).toBe(0);
    expect(result.reviewStage).toBe(0);
    expect(result.hasPenalty).toBe(false);
    expect(result.becameLearned).toBe(true);
    expect(result.wasReset).toBe(false);
    expect(result.wasAdvanced).toBe(true);
    expect(result.nextReviewAt.getTime()).toBe(
      addDays(NOW, REVIEW_DAYS[0]!).getTime(),
    );
  });

  it('count above correctToAdvance still triggers review jump', () => {
    const result = computeTransition(input('production', 3, 0, true), NOW);
    expect(result.tier).toBe('review');
    expect(result.becameLearned).toBe(true);
  });
});

// ─── review ─────────────────────────────────────────────────────────────────

describe('computeTransition — review, wrong answer', () => {
  // Wrong on review: rolls back to learningConfig.intervals.reviewWrongRollbackTier
  // (currently 'active'), reviewStage=0, scheduled REVIEW_WRONG_DAYS days ahead,
  // wasReset=true, hasPenalty=false (review wrong does NOT set penalty).
  const reviewStages = [0, 1, 2, 3, 4];

  it.each(reviewStages)(
    'reviewStage=%i + wrong → rolls back, cooldown applied, wasReset=true',
    (reviewStage) => {
      const result = computeTransition(
        input('review', 0, reviewStage, false),
        NOW,
      );

      expect(result.tier).toBe(REVIEW_WRONG_TIER);
      expect(result.tierCorrectCount).toBe(0);
      expect(result.reviewStage).toBe(0);
      expect(result.hasPenalty).toBe(false);
      expect(result.becameLearned).toBe(false);
      expect(result.wasReset).toBe(true);
      expect(result.wasAdvanced).toBe(false);
      expect(result.nextReviewAt.getTime()).toBe(
        addDays(NOW, REVIEW_WRONG_DAYS).getTime(),
      );
    },
  );

  it('rollback target matches config (sanity)', () => {
    expect(REVIEW_WRONG_TIER).toBe('active');
  });
});

describe('computeTransition — review, correct answer', () => {
  // Correct on review: nextStage = min(reviewStage + 1, REVIEW_DAYS.length - 1).
  // Schedule = REVIEW_DAYS[nextStage] days. wasAdvanced=false (already learned),
  // becameLearned=false (the flag fires only on the active→review transition).
  const cases: Array<[number, number, number]> = [
    [0, 1, REVIEW_DAYS[1]!],
    [1, 2, REVIEW_DAYS[2]!],
    [2, 3, REVIEW_DAYS[3]!],
    [3, 4, REVIEW_DAYS[4]!],
    [4, 4, REVIEW_DAYS[4]!], // clamped at len-1=4 → 180 days
  ];

  it.each(cases)(
    'reviewStage=%i + correct → nextStage=%i, scheduled %i days ahead',
    (reviewStage, expectedNextStage, expectedDays) => {
      const result = computeTransition(
        input('review', 0, reviewStage, true),
        NOW,
      );

      expect(result.tier).toBe('review');
      expect(result.tierCorrectCount).toBe(0);
      expect(result.reviewStage).toBe(expectedNextStage);
      expect(result.hasPenalty).toBe(false);
      expect(result.becameLearned).toBe(false);
      expect(result.wasReset).toBe(false);
      expect(result.wasAdvanced).toBe(false);
      expect(result.nextReviewAt.getTime()).toBe(
        addDays(NOW, expectedDays).getTime(),
      );
    },
  );

  it('reviewStage clamping: out-of-bounds stage stays clamped at len-1', () => {
    // If somehow reviewStage exceeds the array (shouldn't happen, but
    // defensive), nextStage clamps to len-1.
    const result = computeTransition(input('review', 0, 99, true), NOW);
    expect(result.reviewStage).toBe(REVIEW_DAYS.length - 1);
    expect(result.nextReviewAt.getTime()).toBe(
      addDays(NOW, REVIEW_DAYS[REVIEW_DAYS.length - 1]!).getTime(),
    );
  });

  it('tierCorrectCount in input is ignored on review correct (output count=0)', () => {
    const result = computeTransition(input('review', 5, 1, true), NOW);
    expect(result.tierCorrectCount).toBe(0);
  });
});

// ─── Determinism / output shape ─────────────────────────────────────────────

describe('computeTransition — output shape', () => {
  it('returns a Date for nextReviewAt', () => {
    const result = computeTransition(input('encounter', 0, 0, true), NOW);
    expect(result.nextReviewAt).toBeInstanceOf(Date);
  });

  it('result has all expected keys', () => {
    const result = computeTransition(input('passive', 0, 0, true), NOW);
    expect(Object.keys(result).sort()).toEqual(
      [
        'becameLearned',
        'hasPenalty',
        'nextReviewAt',
        'reviewStage',
        'tier',
        'tierCorrectCount',
        'wasAdvanced',
        'wasReset',
      ].sort(),
    );
  });

  it('uses the supplied `now` for scheduling (no clock side effect)', () => {
    // Pass a wildly different `now` and confirm output relative to it.
    const altNow = new Date('2030-06-15T10:30:00.000Z');
    const result = computeTransition(input('encounter', 0, 0, true), altNow);
    expect(result.nextReviewAt.getTime()).toBe(
      altNow.getTime() + ENC_TO_PASSIVE_H * HOUR_MS,
    );
  });

  it('is deterministic across repeated calls with same input', () => {
    const a = computeTransition(input('passive', 1, 0, true), NOW);
    const b = computeTransition(input('passive', 1, 0, true), NOW);
    expect(a).toEqual(b);
  });
});

// ─── Cross-tier invariants ──────────────────────────────────────────────────

describe('computeTransition — invariants', () => {
  // becameLearned is true only on the transition INTO review for the first
  // time (active→review or production→review). Any other path → false.
  it('becameLearned=true only on active→review and production→review', () => {
    expect(
      computeTransition(input('active', 1, 0, true), NOW).becameLearned,
    ).toBe(true);
    expect(
      computeTransition(input('production', 2, 0, true), NOW).becameLearned,
    ).toBe(true);

    expect(
      computeTransition(input('encounter', 0, 0, true), NOW).becameLearned,
    ).toBe(false);
    expect(
      computeTransition(input('passive', 1, 0, true), NOW).becameLearned,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 0, true), NOW).becameLearned,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 0, false), NOW).becameLearned,
    ).toBe(false);
  });

  // wasReset is true only on review-wrong (rollback to active).
  it('wasReset=true only on review wrong answer', () => {
    expect(
      computeTransition(input('review', 0, 2, false), NOW).wasReset,
    ).toBe(true);

    expect(
      computeTransition(input('encounter', 0, 0, false), NOW).wasReset,
    ).toBe(false);
    expect(
      computeTransition(input('passive', 0, 0, false), NOW).wasReset,
    ).toBe(false);
    expect(
      computeTransition(input('active', 0, 0, false), NOW).wasReset,
    ).toBe(false);
    expect(
      computeTransition(input('production', 0, 0, false), NOW).wasReset,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 0, true), NOW).wasReset,
    ).toBe(false);
  });

  // wasAdvanced is true only on tier-forward transitions (encounter→passive,
  // passive→active, active→production|review, production→review).
  it('wasAdvanced=true only on tier-forward transitions', () => {
    expect(
      computeTransition(input('encounter', 0, 0, true), NOW).wasAdvanced,
    ).toBe(true);
    expect(
      computeTransition(input('passive', 1, 0, true), NOW).wasAdvanced,
    ).toBe(true);
    expect(
      computeTransition(input('active', 1, 0, true), NOW).wasAdvanced,
    ).toBe(true);
    expect(
      computeTransition(input('production', 2, 0, true), NOW).wasAdvanced,
    ).toBe(true);

    // Same-tier or rollback transitions → wasAdvanced=false.
    expect(
      computeTransition(input('passive', 0, 0, true), NOW).wasAdvanced,
    ).toBe(false);
    expect(
      computeTransition(input('passive', 0, 0, false), NOW).wasAdvanced,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 1, true), NOW).wasAdvanced,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 1, false), NOW).wasAdvanced,
    ).toBe(false);
  });

  // hasPenalty=true on output is set ONLY on wrong answers in the learning
  // phase tiers (passive/active/production). Wrong on review clears penalty
  // because review-wrong sets hasPenalty=false (rollback comes with its own
  // 1-day cooldown rather than a penalty flag).
  it('hasPenalty=true only on learning-phase wrong answers', () => {
    expect(
      computeTransition(input('passive', 0, 0, false), NOW).hasPenalty,
    ).toBe(true);
    expect(
      computeTransition(input('active', 0, 0, false), NOW).hasPenalty,
    ).toBe(true);
    expect(
      computeTransition(input('production', 0, 0, false), NOW).hasPenalty,
    ).toBe(true);

    // Encounter wrong, review wrong, and any correct answer → false.
    expect(
      computeTransition(input('encounter', 0, 0, false), NOW).hasPenalty,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 0, false), NOW).hasPenalty,
    ).toBe(false);
    expect(
      computeTransition(input('passive', 0, 0, true), NOW).hasPenalty,
    ).toBe(false);
  });
});
