import { describe, it, expect } from 'vitest';
import { computeTransition, computeBatchSize, type TransitionInput } from './learning-service.js';
import { learningConfig } from '../config/learning-config.js';

// Все интервалы относительно фиксированного «сейчас». Функция чистая.
const NOW = new Date('2026-06-01T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

function input(overrides: Partial<TransitionInput>): TransitionInput {
  return {
    tier: 'pool',
    tierCorrectCount: 0,
    reviewStage: 0,
    consecutiveEasyOrGood: 0,
    ...overrides,
  };
}

const GRID = learningConfig.reviewGrid;
const LAST_STAGE = GRID.length - 1; // 7
const MOD = learningConfig.reviewGradeModifiers;
const MASTERED_AFTER = learningConfig.reviewMasteredAfter; // 2

// ─── passive (L1) ───────────────────────────────────────────────────────────

describe('computeTransition — passive (L1)', () => {
  const PASSIVE_THRESHOLD = learningConfig.tiers.passive.correctToAdvance;

  it(`correct: tcc=${PASSIVE_THRESHOLD - 1} (на 1 меньше порога) → advance в active`, () => {
    const r = computeTransition(
      input({ tier: 'passive', tierCorrectCount: PASSIVE_THRESHOLD - 1, isCorrect: true }),
      NOW,
    );
    expect(r.tier).toBe('active');
    expect(r.tierCorrectCount).toBe(0);
    expect(r.wasAdvanced).toBe(true);
    expect(r.becameMastered).toBe(false);
  });

  it.skipIf(PASSIVE_THRESHOLD === 1)(
    'correct: tcc=0 → tcc=1, остаёмся на passive (только при пороге >1)',
    () => {
      const r = computeTransition(input({ tier: 'passive', isCorrect: true }), NOW);
      expect(r.tier).toBe('passive');
      expect(r.tierCorrectCount).toBe(1);
      expect(r.wasAdvanced).toBe(false);
    },
  );

  it('wrong: tcc сбрасывается, остаёмся на passive (откатов нет)', () => {
    const r = computeTransition(input({ tier: 'passive', tierCorrectCount: 1, isCorrect: false }), NOW);
    expect(r.tier).toBe('passive');
    expect(r.tierCorrectCount).toBe(0);
    expect(r.wasAdvanced).toBe(false);
    expect(r.wasReset).toBe(false);
  });

  it('correctToAdvance синхронизирован с конфигом', () => {
    const cfg = learningConfig.tiers.passive.correctToAdvance;
    // Если в конфиге N, то N-1 правильных подряд → ещё passive, на N-м → active
    const onePrior = computeTransition(
      input({ tier: 'passive', tierCorrectCount: cfg - 1, isCorrect: true }),
      NOW,
    );
    expect(onePrior.tier).toBe('active');
  });
});

// ─── active (L2) ────────────────────────────────────────────────────────────

describe('computeTransition — active (L2)', () => {
  it('correct: tcc=0 → tcc=1, остаёмся на active', () => {
    const r = computeTransition(input({ tier: 'active', isCorrect: true }), NOW);
    expect(r.tier).toBe('active');
    expect(r.tierCorrectCount).toBe(1);
  });

  it(`correct: tcc=${learningConfig.tiers.active.correctToAdvance - 1} → review stage=0, nextReviewAt = NOW + 1 день`, () => {
    const r = computeTransition(
      input({
        tier: 'active',
        tierCorrectCount: learningConfig.tiers.active.correctToAdvance - 1,
        isCorrect: true,
      }),
      NOW,
    );
    expect(r.tier).toBe('review');
    expect(r.reviewStage).toBe(0);
    expect(r.wasAdvanced).toBe(true);
    expect(r.nextReviewAt.getTime()).toBe(addDays(NOW, GRID[0]!).getTime());
  });

  it('wrong: tcc сбрасывается, остаёмся на active', () => {
    const r = computeTransition(input({ tier: 'active', tierCorrectCount: 1, isCorrect: false }), NOW);
    expect(r.tier).toBe('active');
    expect(r.tierCorrectCount).toBe(0);
    expect(r.wasAdvanced).toBe(false);
  });
});

// ─── review (L3) — grade-based SM-2 ─────────────────────────────────────────

describe('computeTransition — review again', () => {
  it('grade=again → откат в active, tcc=0, reviewStage=0, wasReset=true', () => {
    const r = computeTransition(
      input({ tier: 'review', reviewStage: 3, consecutiveEasyOrGood: 1, grade: 'again' }),
      NOW,
    );
    expect(r.tier).toBe('active');
    expect(r.tierCorrectCount).toBe(0);
    expect(r.reviewStage).toBe(0);
    expect(r.consecutiveEasyOrGood).toBe(0);
    expect(r.wasReset).toBe(true);
    expect(r.becameMastered).toBe(false);
  });
});

describe('computeTransition — review нормальные шаги (stage < lastStage)', () => {
  it.each([
    { grade: 'good' as const, mod: MOD.good },
    { grade: 'hard' as const, mod: MOD.hard },
    { grade: 'easy' as const, mod: MOD.easy },
  ])('stage=0 grade=$grade → stage=1, interval = grid[1] * $mod', ({ grade, mod }) => {
    const r = computeTransition(
      input({ tier: 'review', reviewStage: 0, grade }),
      NOW,
    );
    expect(r.tier).toBe('review');
    expect(r.reviewStage).toBe(1);
    expect(r.becameMastered).toBe(false);
    const expectedDays = GRID[1]! * mod;
    expect(r.nextReviewAt.getTime()).toBe(addDays(NOW, expectedDays).getTime());
  });

  it('переход stage=6 (180д) → stage=7 (365д) на good', () => {
    const r = computeTransition(input({ tier: 'review', reviewStage: 6, grade: 'good' }), NOW);
    expect(r.reviewStage).toBe(7);
    expect(r.nextReviewAt.getTime()).toBe(addDays(NOW, GRID[7]!).getTime());
    expect(r.becameMastered).toBe(false);
  });

  it('счётчик consecutiveEasyOrGood обнуляется когда stage < lastStage', () => {
    const r = computeTransition(
      input({ tier: 'review', reviewStage: 4, consecutiveEasyOrGood: 1, grade: 'good' }),
      NOW,
    );
    expect(r.consecutiveEasyOrGood).toBe(0);
  });
});

// ─── review финальный stage (SM-2 mastered logic) ───────────────────────────

describe('computeTransition — review финальный stage', () => {
  it('stage=7 + good (consec=0) → consec=1, остаёмся на stage=7, не mastered', () => {
    const r = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: 0, grade: 'good' }),
      NOW,
    );
    expect(r.tier).toBe('review');
    expect(r.reviewStage).toBe(LAST_STAGE);
    expect(r.consecutiveEasyOrGood).toBe(1);
    expect(r.becameMastered).toBe(false);
    // интервал = grid[7] * good_modifier
    expect(r.nextReviewAt.getTime()).toBe(addDays(NOW, GRID[LAST_STAGE]! * MOD.good).getTime());
  });

  it('stage=7 + good (consec=1) → MASTERED', () => {
    const r = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: MASTERED_AFTER - 1, grade: 'good' }),
      NOW,
    );
    expect(r.tier).toBe('mastered');
    expect(r.becameMastered).toBe(true);
    expect(r.wasAdvanced).toBe(true);
  });

  it('stage=7 + easy (consec=1) → MASTERED (easy эквивалент good для выпуска)', () => {
    const r = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: 1, grade: 'easy' }),
      NOW,
    );
    expect(r.tier).toBe('mastered');
    expect(r.becameMastered).toBe(true);
  });

  it('stage=7 + hard → consec СБРАСЫВАЕТСЯ, не mastered (edge: «hard сбрасывает счётчик выпуска»)', () => {
    const r = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: 1, grade: 'hard' }),
      NOW,
    );
    expect(r.tier).toBe('review');
    expect(r.reviewStage).toBe(LAST_STAGE);
    expect(r.consecutiveEasyOrGood).toBe(0);
    expect(r.becameMastered).toBe(false);
    // интервал = grid[7] * hard_modifier
    expect(r.nextReviewAt.getTime()).toBe(addDays(NOW, GRID[LAST_STAGE]! * MOD.hard).getTime());
  });

  it('паттерн hard-good-hard-good на stage=7 НЕ ведёт к mastered', () => {
    // 1: consec=0, hard → consec=0
    let s = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: 0, grade: 'hard' }),
      NOW,
    );
    expect(s.consecutiveEasyOrGood).toBe(0);
    // 2: consec=0, good → consec=1, не mastered
    s = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: s.consecutiveEasyOrGood, grade: 'good' }),
      NOW,
    );
    expect(s.consecutiveEasyOrGood).toBe(1);
    expect(s.becameMastered).toBe(false);
    // 3: consec=1, hard → consec=0 (сбрасывается)
    s = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: s.consecutiveEasyOrGood, grade: 'hard' }),
      NOW,
    );
    expect(s.consecutiveEasyOrGood).toBe(0);
    // 4: consec=0, good → consec=1, не mastered (а должен бы по паттерну hard-good-hard-good)
    s = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: s.consecutiveEasyOrGood, grade: 'good' }),
      NOW,
    );
    expect(s.becameMastered).toBe(false);
  });

  it('паттерн good-good на stage=7 → MASTERED', () => {
    let s = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: 0, grade: 'good' }),
      NOW,
    );
    expect(s.becameMastered).toBe(false);
    s = computeTransition(
      input({ tier: 'review', reviewStage: LAST_STAGE, consecutiveEasyOrGood: s.consecutiveEasyOrGood, grade: 'good' }),
      NOW,
    );
    expect(s.becameMastered).toBe(true);
    expect(s.tier).toBe('mastered');
  });
});

// ─── SM-2 формула: nextInterval = grid[stage+1] * modifier ──────────────────

describe('computeTransition — SM-2 формула', () => {
  // Все шаги stage < lastStage должны давать grid[stage+1] * modifier.
  for (let stage = 0; stage < LAST_STAGE; stage++) {
    const targetStage = stage + 1;
    it(`stage=${stage} good → grid[${targetStage}] = ${GRID[targetStage]} дней`, () => {
      const r = computeTransition(input({ tier: 'review', reviewStage: stage, grade: 'good' }), NOW);
      expect(r.nextReviewAt.getTime()).toBe(addDays(NOW, GRID[targetStage]! * MOD.good).getTime());
    });
    it(`stage=${stage} easy → grid[${targetStage}] × ${MOD.easy} = ${GRID[targetStage]! * MOD.easy} дней`, () => {
      const r = computeTransition(input({ tier: 'review', reviewStage: stage, grade: 'easy' }), NOW);
      expect(r.nextReviewAt.getTime()).toBe(addDays(NOW, GRID[targetStage]! * MOD.easy).getTime());
    });
    it(`stage=${stage} hard → grid[${targetStage}] × ${MOD.hard} = ${GRID[targetStage]! * MOD.hard} дней`, () => {
      const r = computeTransition(input({ tier: 'review', reviewStage: stage, grade: 'hard' }), NOW);
      expect(r.nextReviewAt.getTime()).toBe(addDays(NOW, GRID[targetStage]! * MOD.hard).getTime());
    });
  }
});

// ─── pool — должен быть no-op (свайпы через applyPoolSwipe, не computeTransition) ─

describe('computeTransition — pool tier', () => {
  it('pool: возвращает no-op transition (никакого продвижения)', () => {
    const r = computeTransition(input({ tier: 'pool', isCorrect: true }), NOW);
    expect(r.tier).toBe('pool');
    expect(r.wasAdvanced).toBe(false);
  });
});

// ─── mastered — терминал ────────────────────────────────────────────────────

describe('computeTransition — mastered', () => {
  it('mastered: any input → остаёмся на mastered (терминал)', () => {
    const r = computeTransition(input({ tier: 'mastered', grade: 'good' }), NOW);
    expect(r.tier).toBe('mastered');
    expect(r.becameMastered).toBe(false);
  });
});

// ─── Регрессия багов из ручного тестирования ────────────────────────────────

describe('computeTransition — регрессии', () => {
  it('passive correct с isCorrect — не падает (passive рулит через isCorrect)', () => {
    const r = computeTransition(input({ tier: 'passive', isCorrect: true }), NOW);
    // Tier либо passive (если порог >1), либо active (если порог=1).
    expect(['passive', 'active']).toContain(r.tier);
  });

  it('review без grade (например, isCorrect=true пришло вместо grade) — no-op, не падает', () => {
    const r = computeTransition(input({ tier: 'review', isCorrect: true }), NOW);
    expect(r.tier).toBe('review');
    expect(r.wasAdvanced).toBe(false);
  });

  it('passive без isCorrect — no-op (защита от программной ошибки)', () => {
    const r = computeTransition(input({ tier: 'passive' }), NOW);
    expect(r.tier).toBe('passive');
    expect(r.tierCorrectCount).toBe(0);
  });
});

// ─── computeBatchSize — pool → passive промоушн ────────────────────────────

describe('computeBatchSize', () => {
  const LIMIT = learningConfig.dailyPromotionLimit; // 10
  const SIZE = learningConfig.learningBatchSize;    // 10
  const MIN = learningConfig.minBatchSize;           // 3

  it('daily >= limit → skip с reason daily_limit_reached', () => {
    expect(computeBatchSize(20, LIMIT)).toEqual({ decision: 'skip', reason: 'daily_limit_reached' });
    expect(computeBatchSize(20, LIMIT + 5)).toEqual({ decision: 'skip', reason: 'daily_limit_reached' });
  });

  it(`pool < ${MIN} → skip с reason pool_below_min`, () => {
    expect(computeBatchSize(0, 0)).toEqual({ decision: 'skip', reason: 'pool_below_min' });
    expect(computeBatchSize(MIN - 1, 0)).toEqual({ decision: 'skip', reason: 'pool_below_min' });
  });

  it(`pool=${MIN}, daily=0 → promote ${MIN}`, () => {
    expect(computeBatchSize(MIN, 0)).toEqual({ decision: 'promote', size: MIN });
  });

  it(`pool >> limit, daily=0 → promote ${SIZE} (учебный batch)`, () => {
    expect(computeBatchSize(50, 0)).toEqual({ decision: 'promote', size: SIZE });
  });

  it('pool=15, daily=4 → promote 6 (до лимита)', () => {
    expect(computeBatchSize(15, 4)).toEqual({ decision: 'promote', size: 6 });
  });

  it(`pool=15, daily=8 → promote ${MIN} (soft-overflow, итого 11)`, () => {
    expect(computeBatchSize(15, 8)).toEqual({ decision: 'promote', size: MIN });
  });

  it(`pool=15, daily=9 → promote ${MIN} (soft-overflow, итого 12)`, () => {
    expect(computeBatchSize(15, 9)).toEqual({ decision: 'promote', size: MIN });
  });

  it('pool=7, daily=0 → promote 7 (меньше стандарта, но ≥ min)', () => {
    expect(computeBatchSize(7, 0)).toEqual({ decision: 'promote', size: 7 });
  });

  it('boundary: pool=eligibleCount=limit, daily=0 → promote=limit', () => {
    expect(computeBatchSize(SIZE, 0)).toEqual({ decision: 'promote', size: SIZE });
  });
});
