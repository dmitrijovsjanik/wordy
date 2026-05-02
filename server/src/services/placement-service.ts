import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, wordMeanings, words, collections, userCollections, placementResults, collectionWords, userWordProgress } from '../db/schema.js';
import { LEARNED_PROGRESS } from './srs-service.js';
import { generateFromMeaning, getPopularityFilter, getFrequencyFilter, CYRILLIC_FILTER } from './game/generators/multiple-choice.js';
import type { PooledMeaning, LegacyQuestion } from './game/types.js';
import {
  PLACEMENT_QUESTIONS_COUNT, WORDS_PER_LEVEL, CEFR_ORDER,
  DEFAULT_LEVEL, LEVEL_ACCURACY_THRESHOLD, VOCAB_ESTIMATES,
  PERCENTILE_BY_LEVEL, SESSION_TTL_MS,
  type PlacementCefrLevel,
} from '../config/placement-config.js';
import { recordEvent } from './analytics-service.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type PlacementAnswer = {
  meaningId: number;
  cefrLevel: string;
  isCorrect: boolean;
  answerTimeMs: number;
};

type PlacementSession = {
  userId: number;
  selfAssessment: string | null;
  currentLevel: string;
  wordPools: Record<string, number[]>;
  usedIds: Set<number>;
  answers: PlacementAnswer[];
  questionNumber: number;
  createdAt: number;
};

// ─── In-memory session store ────────────────────────────────────────────────

const sessions = new Map<number, PlacementSession>();

// POS collection titles to exclude from auto-subscribe (only main level collections)
const POS_TITLES = ['Существительные', 'Глаголы', 'Прилагательные', 'Наречия'];

/** Remove expired sessions (called on every access) */
function cleanupExpired(): void {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(userId);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isValidCefrLevel(level: string): level is PlacementCefrLevel {
  return (CEFR_ORDER as readonly string[]).includes(level);
}

function cefrIndex(level: string): number {
  return CEFR_ORDER.indexOf(level as PlacementCefrLevel);
}

function levelUp(level: string): string {
  const idx = cefrIndex(level);
  if (idx < 0 || idx >= CEFR_ORDER.length - 1) return level;
  return CEFR_ORDER[idx + 1]!;
}

function levelDown(level: string): string {
  const idx = cefrIndex(level);
  if (idx <= 0) return level;
  return CEFR_ORDER[idx - 1]!;
}

/** Pick a random unused meaningId from the given level's pool, or try adjacent levels */
function pickFromPool(session: PlacementSession): { meaningId: number; level: string } | null {
  const currentIdx = cefrIndex(session.currentLevel);
  if (currentIdx < 0) return null;

  // Try current level first
  const currentPool = session.wordPools[session.currentLevel];
  if (currentPool) {
    const available = currentPool.filter(id => !session.usedIds.has(id));
    if (available.length > 0) {
      const meaningId = available[Math.floor(Math.random() * available.length)]!;
      return { meaningId, level: session.currentLevel };
    }
  }

  // Try adjacent levels (closer first)
  for (let offset = 1; offset < CEFR_ORDER.length; offset++) {
    for (const dir of [1, -1]) {
      const adjIdx = currentIdx + offset * dir;
      if (adjIdx < 0 || adjIdx >= CEFR_ORDER.length) continue;
      const adjLevel = CEFR_ORDER[adjIdx]!;
      const adjPool = session.wordPools[adjLevel];
      if (adjPool) {
        const available = adjPool.filter(id => !session.usedIds.has(id));
        if (available.length > 0) {
          const meaningId = available[Math.floor(Math.random() * available.length)]!;
          return { meaningId, level: adjLevel };
        }
      }
    }
  }

  return null;
}

/** Load a PooledMeaning from DB by meaningId */
async function loadMeaning(meaningId: number): Promise<PooledMeaning | null> {
  const result = await db.query.wordMeanings.findFirst({
    where: eq(wordMeanings.id, meaningId),
    with: { word: true },
    columns: {
      id: true,
      wordId: true,
      translation: true,
      alternativeTranslations: true,
      difficulty: true,
      partOfSpeech: true,
      synonyms: true,
      examples: true,
    },
  });

  if (!result) return null;
  return result as PooledMeaning;
}

/** Generate an MC question for a given meaningId */
async function generateQuestion(meaningId: number): Promise<LegacyQuestion | null> {
  const meaning = await loadMeaning(meaningId);
  if (!meaning) return null;
  return generateFromMeaning(meaning, 'en-ru', 'en-ru');
}

// ─── Word bank loading ──────────────────────────────────────────────────────

async function loadWordPools(): Promise<Record<string, number[]>> {
  const popularityFilter = getPopularityFilter();
  const frequencyFilter = getFrequencyFilter();

  const pools: Record<string, number[]> = {};

  for (const level of CEFR_ORDER) {
    const rows = await db
      .select({ id: wordMeanings.id })
      .from(wordMeanings)
      .innerJoin(words, eq(wordMeanings.wordId, words.id))
      .where(
        and(
          eq(wordMeanings.cefr, level),
          popularityFilter,
          frequencyFilter,
          CYRILLIC_FILTER,
        ),
      )
      .orderBy(sql`RANDOM()`)
      .limit(WORDS_PER_LEVEL);

    pools[level] = rows.map(r => r.id);
  }

  return pools;
}

// ─── Auto-subscribe helper ──────────────────────────────────────────────────

/** Subscribe user to main level collections (excluding POS) */
async function autoSubscribeCollections(userId: number, level: PlacementCefrLevel, includeBelow = true): Promise<void> {
  const levelIdx = cefrIndex(level);
  const levelsToSubscribe = includeBelow
    ? CEFR_ORDER.filter((_, idx) => idx <= levelIdx)
    : [level];

  const systemCollections = await db
    .select({ id: collections.id, title: collections.title })
    .from(collections)
    .where(
      and(
        eq(collections.type, 'system'),
        eq(collections.isPublished, true),
        inArray(collections.cefrLevel, levelsToSubscribe),
      ),
    );

  // Exclude POS collections (Существительные, Глаголы, etc.)
  const mainCollections = systemCollections.filter(c => !POS_TITLES.includes(c.title));

  if (mainCollections.length === 0) return;

  const existingSubs = await db
    .select({ collectionId: userCollections.collectionId })
    .from(userCollections)
    .where(
      and(
        eq(userCollections.userId, userId),
        inArray(userCollections.collectionId, mainCollections.map(c => c.id)),
      ),
    );

  const existingIds = new Set(existingSubs.map(s => s.collectionId));
  const newSubs = mainCollections
    .filter(c => !existingIds.has(c.id))
    .map(c => ({ userId, collectionId: c.id }));

  if (newSubs.length > 0) {
    await db.insert(userCollections).values(newSubs);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Initialize a placement session for the user.
 * Returns the first question.
 */
export async function startPlacement(
  userId: number,
  selfAssessment?: string,
): Promise<{ question: LegacyQuestion; questionNumber: number; totalQuestions: number } | null> {
  cleanupExpired();

  // Determine starting level
  const startLevel = selfAssessment && isValidCefrLevel(selfAssessment)
    ? selfAssessment
    : DEFAULT_LEVEL;

  // Load word pools from DB
  const wordPools = await loadWordPools();

  const session: PlacementSession = {
    userId,
    selfAssessment: selfAssessment ?? null,
    currentLevel: startLevel,
    wordPools,
    usedIds: new Set(),
    answers: [],
    questionNumber: 0,
    createdAt: Date.now(),
  };

  sessions.set(userId, session);

  // Generate first question
  const pick = pickFromPool(session);
  if (!pick) return null;

  session.usedIds.add(pick.meaningId);
  session.questionNumber = 1;

  const question = await generateQuestion(pick.meaningId);
  if (!question) return null;

  await recordEvent({
    userId,
    eventType: 'onboarding_step',
    payload: { step: 'placement_started', selfAssessment: selfAssessment ?? null, startLevel },
  });

  return {
    question,
    questionNumber: 1,
    totalQuestions: PLACEMENT_QUESTIONS_COUNT,
  };
}

/**
 * Record an answer, adapt difficulty, return next question or signal finish.
 */
export async function answerPlacement(
  userId: number,
  meaningId: number,
  selectedOption: string,
  answerTimeMs: number,
): Promise<{
  isCorrect: boolean;
  correctTranslation: string;
  finished: boolean;
  question?: LegacyQuestion;
  questionNumber?: number;
  totalQuestions?: number;
} | null> {
  cleanupExpired();

  const session = sessions.get(userId);
  if (!session) return null;

  // Check answer correctness
  const meaning = await loadMeaning(meaningId);
  if (!meaning) return null;

  const correctTranslation = meaning.translation;
  const allTranslations = [meaning.translation, ...(meaning.alternativeTranslations ?? [])];
  const isCorrect = allTranslations.includes(selectedOption);

  // Record answer
  session.answers.push({
    meaningId,
    cefrLevel: session.currentLevel,
    isCorrect,
    answerTimeMs,
  });

  await recordEvent({
    userId,
    eventType: 'onboarding_step',
    meaningId,
    questionType: 'multiple-choice',
    isCorrect,
    answerTimeMs,
    payload: {
      step: 'placement_answered',
      level: session.currentLevel,
      questionNumber: session.answers.length,
    },
  });

  // Adapt difficulty
  if (isCorrect) {
    session.currentLevel = levelUp(session.currentLevel);
  } else {
    session.currentLevel = levelDown(session.currentLevel);
  }

  // Check if finished
  if (session.answers.length >= PLACEMENT_QUESTIONS_COUNT) {
    return {
      isCorrect,
      correctTranslation,
      finished: true,
    };
  }

  // Generate next question
  const pick = pickFromPool(session);
  if (!pick) {
    // No more words available — finish early
    return {
      isCorrect,
      correctTranslation,
      finished: true,
    };
  }

  session.usedIds.add(pick.meaningId);
  session.questionNumber = session.answers.length + 1;

  const nextQuestion = await generateQuestion(pick.meaningId);
  if (!nextQuestion) {
    return {
      isCorrect,
      correctTranslation,
      finished: true,
    };
  }

  return {
    isCorrect,
    correctTranslation,
    finished: false,
    question: nextQuestion,
    questionNumber: session.questionNumber,
    totalQuestions: PLACEMENT_QUESTIONS_COUNT,
  };
}

/**
 * Calculate placement result, save to DB. Does NOT subscribe to collections.
 * User chooses subscription mode on the result screen, then calls finalizePlacement.
 */
export async function completePlacement(userId: number): Promise<{
  resultCefr: PlacementCefrLevel;
  estimatedVocabulary: number;
  percentile: number;
  correctCount: number;
  totalQuestions: number;
} | null> {
  cleanupExpired();

  const session = sessions.get(userId);
  if (!session) return null;

  // Calculate accuracy per level
  const levelStats: Record<string, { correct: number; total: number }> = {};
  for (const answer of session.answers) {
    const lvl = answer.cefrLevel;
    if (!levelStats[lvl]) {
      levelStats[lvl] = { correct: 0, total: 0 };
    }
    levelStats[lvl].total++;
    if (answer.isCorrect) {
      levelStats[lvl].correct++;
    }
  }

  // Result = highest level where accuracy >= threshold AND at least 2 questions asked
  let resultCefr: PlacementCefrLevel = 'a1';
  for (const level of CEFR_ORDER) {
    const stats = levelStats[level];
    if (stats && stats.total >= 2) {
      const accuracy = stats.correct / stats.total;
      if (accuracy >= LEVEL_ACCURACY_THRESHOLD) {
        resultCefr = level;
      }
    }
  }

  const estimatedVocabulary = VOCAB_ESTIMATES[resultCefr];
  const percentile = PERCENTILE_BY_LEVEL[resultCefr];
  const correctCount = session.answers.filter(a => a.isCorrect).length;
  const totalQuestions = session.answers.length;

  // Save placement result to DB
  const answersJson = session.answers.map(a => ({
    meaningId: a.meaningId,
    cefrLevel: a.cefrLevel,
    isCorrect: a.isCorrect,
    answerTimeMs: a.answerTimeMs,
  }));

  await db.delete(placementResults).where(eq(placementResults.userId, userId));

  await db.insert(placementResults).values({
    userId,
    selfAssessment: session.selfAssessment && isValidCefrLevel(session.selfAssessment)
      ? session.selfAssessment
      : null,
    resultCefr,
    totalQuestions,
    correctCount,
    estimatedVocabulary,
    answersJson,
  });

  // Update estimatedCefr (but NOT onboardingCompletedAt — that happens in finalize)
  await db
    .update(users)
    .set({ estimatedCefr: resultCefr, updatedAt: new Date() })
    .where(eq(users.id, userId));

  // Cleanup session
  sessions.delete(userId);

  await recordEvent({
    userId,
    eventType: 'onboarding_step',
    payload: {
      step: 'placement_completed',
      resultCefr,
      correctCount,
      totalQuestions,
      estimatedVocabulary,
    },
  });

  return {
    resultCefr,
    estimatedVocabulary,
    percentile,
    correctCount,
    totalQuestions,
  };
}

/**
 * Finalize onboarding: subscribe to collections and optionally mark lower-level words as learned.
 * mode = 'all': subscribe to all levels <= result, mark lower levels as learned
 * mode = 'current-only': subscribe only to result level
 */
export async function finalizePlacement(
  userId: number,
  mode: 'all' | 'current-only',
): Promise<void> {
  // Get user's placement result
  const [result] = await db
    .select({ resultCefr: placementResults.resultCefr })
    .from(placementResults)
    .where(eq(placementResults.userId, userId))
    .limit(1);

  if (!result) throw new Error('Placement result not found');

  const resultCefr = result.resultCefr as PlacementCefrLevel;

  if (mode === 'all') {
    // Subscribe to all levels <= result
    await autoSubscribeCollections(userId, resultCefr, true);

    // Mark rank=1 meanings from lower levels as learned
    const resultIdx = cefrIndex(resultCefr);
    if (resultIdx > 0) {
      const lowerLevels = CEFR_ORDER.filter((_, idx) => idx < resultIdx);
      await markLowerLevelWordsAsLearned(userId, lowerLevels);
    }
  } else {
    // Subscribe only to result level
    await autoSubscribeCollections(userId, resultCefr, false);
  }

  // Mark onboarding as completed
  await db
    .update(users)
    .set({ onboardingCompletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  await recordEvent({
    userId,
    eventType: 'onboarding_step',
    payload: { step: 'placement_finalized', mode, resultCefr },
  });
}

/**
 * Mark rank=1 meanings from given CEFR levels as learned (srsStage=3).
 * Only affects meanings in system collections (non-POS), rank=1, freq>=5.
 */
async function markLowerLevelWordsAsLearned(
  userId: number,
  levels: PlacementCefrLevel[],
): Promise<void> {
  if (levels.length === 0) return;

  // Find main (non-POS) system collections for these levels
  const sysCols = await db
    .select({ id: collections.id, title: collections.title })
    .from(collections)
    .where(
      and(
        eq(collections.type, 'system'),
        eq(collections.isPublished, true),
        inArray(collections.cefrLevel, levels),
      ),
    );

  const mainColIds = sysCols.filter(c => !POS_TITLES.includes(c.title)).map(c => c.id);
  if (mainColIds.length === 0) return;

  // Get all rank=1 meaningIds from these collections
  const meaningRows = await db
    .select({ meaningId: collectionWords.meaningId })
    .from(collectionWords)
    .innerJoin(wordMeanings, eq(collectionWords.meaningId, wordMeanings.id))
    .where(
      and(
        inArray(collectionWords.collectionId, mainColIds),
        eq(wordMeanings.popularityRank, 1),
      ),
    );

  const meaningIds = meaningRows.map(r => r.meaningId);
  if (meaningIds.length === 0) return;

  // Find already existing progress for this user
  const existingProgress = await db
    .select({ meaningId: userWordProgress.meaningId })
    .from(userWordProgress)
    .where(
      and(
        eq(userWordProgress.userId, userId),
        inArray(userWordProgress.meaningId, meaningIds),
      ),
    );

  const existingSet = new Set(existingProgress.map(p => p.meaningId));
  const newMeaningIds = meaningIds.filter(id => !existingSet.has(id));
  if (newMeaningIds.length === 0) return;

  const now = new Date();
  const reviewAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

  // Bulk insert in batches of 500
  const BATCH_SIZE = 500;
  for (let i = 0; i < newMeaningIds.length; i += BATCH_SIZE) {
    const batch = newMeaningIds.slice(i, i + BATCH_SIZE);
    await db.insert(userWordProgress).values(
      batch.map(meaningId => ({
        userId,
        meaningId,
        srsStage: LEARNED_PROGRESS,
        correctCount: 3,
        masteredAt: now,
        nextReviewAt: reviewAt,
        reviewStage: 0,
        hasPenalty: false,
        fromPlacement: true,
        lastSeenAt: now,
      })),
    );
  }
}

/**
 * Skip placement test — directly assign a CEFR level, subscribe to matching collections.
 */
export async function skipPlacement(
  userId: number,
  selectedCefr: string,
): Promise<{ resultCefr: PlacementCefrLevel }> {
  cleanupExpired();

  // Clean up any active session
  sessions.delete(userId);

  const resultCefr: PlacementCefrLevel = isValidCefrLevel(selectedCefr)
    ? selectedCefr
    : DEFAULT_LEVEL;

  // Skip always subscribes to current level only (user can add more from catalog)
  await autoSubscribeCollections(userId, resultCefr, false);

  // Update user profile
  await db
    .update(users)
    .set({
      estimatedCefr: resultCefr,
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  await recordEvent({
    userId,
    eventType: 'onboarding_step',
    payload: { step: 'placement_skipped', selectedCefr, resultCefr },
  });

  return { resultCefr };
}
