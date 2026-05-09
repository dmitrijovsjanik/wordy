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
  // Encounter is just a "card shown" tier. ANY answer (correct or wrong)
  // advances to active (passive скрыт из потока — см. computeTransition).
  it.each([true, false])(
    'isCorrect=%s → advances to active, count=0',
    (isCorrect) => {
      const result = computeTransition(input('encounter', 0, 0, isCorrect), NOW);

      expect(result.tier).toBe('active');
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
    expect(result.tier).toBe('active');
    expect(result.tierCorrectCount).toBe(0);
    expect(result.reviewStage).toBe(0);
  });

  it('ignores hasPenalty=true in input (output penalty is false)', () => {
    const result = computeTransition(input('encounter', 0, 0, true, true), NOW);
    expect(result.hasPenalty).toBe(false);
  });
});

// ─── passive (legacy migrate-on-touch) ──────────────────────────────────────
// Passive скрыт из потока, в БД могут быть legacy-записи. Любой ответ
// (правильный/неправильный) при tier='passive' переводит на active с
// tcc=0, wasAdvanced=true, без penalty. Это обеспечивает само-очищение
// БД от legacy-passive за один ответ. K-cooldown на ошибку (=4) ставится
// в recordWordAnswer отдельно (К3), не в computeTransition.

describe('computeTransition — passive (legacy migrate-on-touch)', () => {
  const cases: Array<[number, number, boolean]> = [
    [0, 0, true],
    [1, 0, true],
    [0, 3, true],
    [0, 0, false],
    [1, 0, false],
  ];

  it.each(cases)(
    'count=%i reviewStage=%i isCorrect=%s → migrates to active, tcc=0, wasAdvanced=true',
    (count, reviewStage, isCorrect) => {
      const result = computeTransition(input('passive', count, reviewStage, isCorrect), NOW);

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
    },
  );
});

describe('computeTransition — active (replaces former passive→active path)', () => {
  // После скрытия passive ровно та же траектория correct→advance работает
  // на active: 2 правильных → production. Не дублирую — покрыто блоком
  // "active" ниже. Этот блок-плейсхолдер удержать namespace.
  it('count=1 + correct → advances to production', () => {
    const result = computeTransition(input('active', 1, 0, true), NOW);

    expect(result.tier).toBe('production');
    expect(result.tierCorrectCount).toBe(0);
    expect(result.wasAdvanced).toBe(true);
    expect(result.nextReviewAt.getTime()).toBe(
      addHours(NOW, LEARN_HOURS[0]!).getTime(),
    );
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
  // correctToAdvance for active is 1. Любой правильный → advances to production.
  // Стимул на active — список ВСЕХ переводов слова, так что одно показывание
  // покрывает все meanings слова на этом уровне.
  it('count=0 + correct → advances to production immediately', () => {
    expect(learningConfig.tiers.production.enabled).toBe(true);

    const result = computeTransition(input('active', 0, 0, true), NOW);

    expect(result.tier).toBe('production');
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

  it('count above correctToAdvance still triggers production jump', () => {
    const result = computeTransition(input('active', 2, 0, true), NOW);
    expect(result.tier).toBe('production');
    expect(result.becameLearned).toBe(false);
  });

  it('reviewStage in input is ignored on active correct (output reviewStage=0)', () => {
    const result = computeTransition(input('active', 0, 3, true), NOW);
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
  // correctToAdvance for production is 1. Любой правильный → advances to review.
  // Per-meaning: каждый meaning слова имеет свою cloze-карточку и проходит
  // production отдельно. Когда ВСЕ eligible meanings на review, word-level
  // запись тоже идёт на review (см. promoteWordToReview).
  it('count=0 + correct → advances to review, becameLearned=true, REVIEW_DAYS[0]', () => {
    const result = computeTransition(input('production', 0, 0, true), NOW);

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
  // time. С production.enabled=true это только production→review (active→production
  // ставит becameLearned=false, потому что слово ещё не дошло до review).
  it('becameLearned=true only on production→review', () => {
    expect(
      computeTransition(input('production', 2, 0, true), NOW).becameLearned,
    ).toBe(true);

    // active+correct=2 теперь даёт переход в production, не review.
    expect(
      computeTransition(input('active', 1, 0, true), NOW).becameLearned,
    ).toBe(false);

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

  // wasAdvanced is true on tier-forward transitions (encounter→active,
  // active→production|review, production→review) и на legacy passive→active
  // (migrate-on-touch — любой ответ ведёт на active независимо от isCorrect).
  it('wasAdvanced=true only on tier-forward transitions', () => {
    expect(
      computeTransition(input('encounter', 0, 0, true), NOW).wasAdvanced,
    ).toBe(true);
    // passive — всегда migrates to active (любой isCorrect).
    expect(
      computeTransition(input('passive', 0, 0, true), NOW).wasAdvanced,
    ).toBe(true);
    expect(
      computeTransition(input('passive', 0, 0, false), NOW).wasAdvanced,
    ).toBe(true);
    expect(
      computeTransition(input('active', 1, 0, true), NOW).wasAdvanced,
    ).toBe(true);
    expect(
      computeTransition(input('production', 2, 0, true), NOW).wasAdvanced,
    ).toBe(true);

    // active correct → wasAdvanced=true (correctToAdvance=1).
    // Wrong-answer ветки и review → wasAdvanced=false.
    expect(
      computeTransition(input('active', 0, 0, true), NOW).wasAdvanced,
    ).toBe(true);
    expect(
      computeTransition(input('active', 0, 0, false), NOW).wasAdvanced,
    ).toBe(false);
    expect(
      computeTransition(input('production', 0, 0, false), NOW).wasAdvanced,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 1, true), NOW).wasAdvanced,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 1, false), NOW).wasAdvanced,
    ).toBe(false);
  });

  // hasPenalty=true on output is set ONLY on wrong answers in active/production
  // (passive больше не имеет ветки penalty — migrate-on-touch без penalty).
  // Wrong on review clears penalty (rollback comes with its own 1-day cooldown).
  it('hasPenalty=true only on learning-phase wrong answers', () => {
    expect(
      computeTransition(input('active', 0, 0, false), NOW).hasPenalty,
    ).toBe(true);
    expect(
      computeTransition(input('production', 0, 0, false), NOW).hasPenalty,
    ).toBe(true);

    // Encounter wrong, passive wrong (migrate, no penalty), review wrong,
    // any correct → false.
    expect(
      computeTransition(input('encounter', 0, 0, false), NOW).hasPenalty,
    ).toBe(false);
    expect(
      computeTransition(input('passive', 0, 0, false), NOW).hasPenalty,
    ).toBe(false);
    expect(
      computeTransition(input('review', 0, 0, false), NOW).hasPenalty,
    ).toBe(false);
    expect(
      computeTransition(input('active', 0, 0, true), NOW).hasPenalty,
    ).toBe(false);
  });
});

// ─── Lifecycle scenarios ────────────────────────────────────────────────────
//
// «Сшитые» сценарии: прогоняем слово через всю лестницу, последовательно
// подавая выход одного шага на вход следующего. Защита от регрессий вроде
// ситуации с backfill-артефактом — где состояние после Phase D застряло на
// passive, потому что backfill записал tcc=0+correct=2+incorrect=0 и каждый
// последующий correct давал tcc=1, не достигая порога advance=2.
//
// Тесты не делают БД-запросов; chain — это последовательные вызовы чистой
// computeTransition. Если кто-то меняет computeTransition или конфиг — эти
// тесты ловят сломанную лестницу целиком.

describe('lifecycle — happy path encounter → ... → review', () => {
  it('1 encounter + 1 active + 1 production correct → review', () => {
    // Лестница пилота: encounter → active → production → review.
    // 3 ответа всего: каждый tier требует 1 правильный.
    // (production per-meaning — тестируется отдельно через promoteWordToReview.)
    let s: ReturnType<typeof computeTransition> = {
      tier: 'encounter',
      tierCorrectCount: 0,
      reviewStage: 0,
      nextReviewAt: NOW,
      hasPenalty: false,
      becameLearned: false,
      wasReset: false,
      wasAdvanced: false,
    };

    // Шаг 1: encounter — «понятно». Любой ответ → active (passive скрыт), tcc=0.
    s = computeTransition(input(s.tier, s.tierCorrectCount, s.reviewStage, true, s.hasPenalty), NOW);
    expect(s.tier).toBe('active');
    expect(s.tierCorrectCount).toBe(0);
    expect(s.wasAdvanced).toBe(true);
    expect(s.becameLearned).toBe(false);

    // Шаг 2: active correct → production.
    s = computeTransition(input(s.tier, s.tierCorrectCount, s.reviewStage, true, s.hasPenalty), NOW);
    expect(s.tier).toBe('production');
    expect(s.tierCorrectCount).toBe(0);
    expect(s.wasAdvanced).toBe(true);
    expect(s.becameLearned).toBe(false); // production не финал — есть meanings

    // Шаг 3: production correct → review.
    s = computeTransition(input(s.tier, s.tierCorrectCount, s.reviewStage, true, s.hasPenalty), NOW);
    expect(s.tier).toBe('review');
    expect(s.tierCorrectCount).toBe(0);
    expect(s.reviewStage).toBe(0);
    expect(s.becameLearned).toBe(true);
    expect(s.wasAdvanced).toBe(true);
    expect(s.nextReviewAt.getTime()).toBe(addDays(NOW, REVIEW_DAYS[0]!).getTime());
  });

  it('после review correct: reviewStage растёт до конца таблицы интервалов', () => {
    // Имитируем уже выученное слово: tier=review, reviewStage=0.
    let s: ReturnType<typeof computeTransition> = {
      tier: 'review',
      tierCorrectCount: 0,
      reviewStage: 0,
      nextReviewAt: NOW,
      hasPenalty: false,
      becameLearned: false,
      wasReset: false,
      wasAdvanced: false,
    };

    // Через review correct'ы reviewStage идёт 0→1→2→...→cap.
    for (let i = 1; i < REVIEW_DAYS.length; i++) {
      s = computeTransition(input(s.tier, s.tierCorrectCount, s.reviewStage, true, s.hasPenalty), NOW);
      expect(s.tier).toBe('review');
      expect(s.reviewStage).toBe(i);
      expect(s.nextReviewAt.getTime()).toBe(addDays(NOW, REVIEW_DAYS[i]!).getTime());
      expect(s.becameLearned).toBe(false); // не повторяем при последующих повторах
    }

    // Дальше reviewStage должен «прилипнуть» к последнему индексу (cap).
    const beforeCap = s.reviewStage;
    s = computeTransition(input(s.tier, s.tierCorrectCount, s.reviewStage, true, s.hasPenalty), NOW);
    expect(s.reviewStage).toBe(beforeCap); // прилипло
    expect(s.nextReviewAt.getTime()).toBe(addDays(NOW, REVIEW_DAYS[beforeCap]!).getTime());
  });
});

describe('lifecycle — wrong answers and rollbacks', () => {
  it('active W-C: ошибка ставит penalty, следующий correct advance', () => {
    // correctToAdvance=1. Wrong: stays active, penalty=true. Correct: advance.
    let s: ReturnType<typeof computeTransition> = {
      tier: 'active',
      tierCorrectCount: 0,
      reviewStage: 0,
      nextReviewAt: NOW,
      hasPenalty: false,
      becameLearned: false,
      wasReset: false,
      wasAdvanced: false,
    };

    // W: stays active, hasPenalty=true.
    s = computeTransition(input(s.tier, s.tierCorrectCount, s.reviewStage, false, s.hasPenalty), NOW);
    expect(s.tier).toBe('active');
    expect(s.tierCorrectCount).toBe(0);
    expect(s.hasPenalty).toBe(true);
    expect(s.nextReviewAt.getTime()).toBe(addMinutes(NOW, COOLDOWN_MIN).getTime());

    // C: tcc 0→1 ≥ correctToAdvance=1 → advance to production.
    s = computeTransition(input(s.tier, s.tierCorrectCount, s.reviewStage, true, s.hasPenalty), NOW);
    expect(s.tier).toBe('production');
    expect(s.wasAdvanced).toBe(true);
    expect(s.hasPenalty).toBe(false);
  });

  it('review wrong → откат на active с кулдауном reviewWrongCooldownDays', () => {
    const s = computeTransition(input('review', 0, 2, false), NOW);
    expect(s.tier).toBe(REVIEW_WRONG_TIER);
    expect(s.tierCorrectCount).toBe(0);
    expect(s.reviewStage).toBe(0);
    expect(s.wasReset).toBe(true);
    expect(s.becameLearned).toBe(false);
    expect(s.nextReviewAt.getTime()).toBe(addDays(NOW, REVIEW_WRONG_DAYS).getTime());
  });
});

describe('lifecycle — legacy passive migrate-on-touch', () => {
  // После скрытия passive: legacy записи в БД могут иметь tier='passive'.
  // Любой ответ переводит их на active с tcc=0 и wasAdvanced=true. Penalty
  // на ошибку НЕ ставится в computeTransition (оно нейтрально для passive);
  // K=COOLDOWN_ON_ERROR=4 ставится в recordWordAnswer отдельно (К3).
  //
  // Старая backfill-регрессия (passive застрял с tcc=1) сейчас невозможна:
  // одно касание любым isCorrect выводит на active.
  it('passive с tcc=1 + correct → active', () => {
    const s = computeTransition(input('passive', 1, 0, true), NOW);
    expect(s.tier).toBe('active');
    expect(s.tierCorrectCount).toBe(0);
    expect(s.wasAdvanced).toBe(true);
  });

  it('passive с tcc=0 + wrong → active (migrate-on-touch без penalty)', () => {
    const s = computeTransition(input('passive', 0, 0, false), NOW);
    expect(s.tier).toBe('active');
    expect(s.tierCorrectCount).toBe(0);
    expect(s.hasPenalty).toBe(false);
    expect(s.wasAdvanced).toBe(true);
  });
});

