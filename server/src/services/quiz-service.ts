import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordMeanings, quizSessions, quizAnswers, users, userWordProgress, userCustomWords, userCustomWordProgress } from '../db/schema.js';
import { getQuizPool, getErrorsPool, type CustomWordForQuiz } from './collection-service.js';
import { ERRORS_COLLECTION_ID } from '../config/errors-config.js';
import { computeNextReview, LEARNED_PROGRESS } from './srs-service.js';
import {
  rewardCorrectAnswer,
  rewardQuizSessionComplete,
  updateStreakDays,
  addGems,
  XP_CORRECT_ANSWER,
} from './progression-service.js';
import { ANSWER_STREAK_MILESTONES, DAILY_CORRECT_MILESTONES } from '../config/gems-config.js';
import {
  generateRandom,
  generateFromMeaning,
  generateFromCustomWord,
  getAllTranslations,
} from './game/generators/multiple-choice.js';
import {
  generateSpellingFromMeaning,
  generateSpellingFromCustomWord,
  canGenerateSpelling,
} from './game/generators/spelling.js';
import { generateMatchPairsFromPool } from './game/generators/match-pairs.js';
import type { PooledMeaning, LegacyQuestion, LanguagePair, SpellingQuestion, MatchPairsQuestion, GeneratorType } from './game/types.js';
import { DEFAULT_LANG_PAIR, pickGenerator } from './game/types.js';
import { DOUBLE_XP_CHANCE, DOUBLE_XP_TIME_LIMITS, DOUBLE_XP_MULTIPLIER } from '../config/double-xp-config.js';
import { setDoubleXp, validateAndConsume, makeKey, makeMatchPairsKey } from './double-xp-tracker.js';
import { getMskTodayStart, toMskDayStart } from '../lib/msk-date.js';

const QUESTIONS_PER_SESSION = 10;

// ─── Session Management ──────────────────────────────────────────────────────

export async function createSession(userId: number) {
  const [session] = await db
    .insert(quizSessions)
    .values({ userId, type: 'solo' })
    .returning();
  return session!;
}

export async function getAnsweredMeaningIds(sessionId: number): Promise<number[]> {
  const answers = await db.query.quizAnswers.findMany({
    where: eq(quizAnswers.sessionId, sessionId),
    columns: { meaningId: true },
  });
  return answers.map(a => a.meaningId);
}

// ─── Question Generation ─────────────────────────────────────────────────────

// Генерация случайного вопроса из всей БД (для сессий без пула)
export async function generateQuestion(
  excludeMeaningIds: number[] = [],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  fixedDirection?: LanguagePair,
): Promise<LegacyQuestion | null> {
  return generateRandom(excludeMeaningIds, langPair, fixedDirection);
}

// Генерация вопроса из пула пользователя (infinite quiz)
export async function generateQuestionFromPool(
  userId: number,
  excludeMeaningIds: number[] = [],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  collectionId?: number | typeof ERRORS_COLLECTION_ID,
  fixedDirection?: LanguagePair,
  questionType?: 'spelling' | 'match-pairs',
  recentGenerators: GeneratorType[] = [],
): Promise<LegacyQuestion | SpellingQuestion | MatchPairsQuestion | null> {
  const question = await generateQuestionFromPoolInternal(userId, excludeMeaningIds, langPair, collectionId, fixedDirection, questionType, recentGenerators);
  return maybeApplyDoubleXp(question, userId);
}

async function generateQuestionFromPoolInternal(
  userId: number,
  excludeMeaningIds: number[] = [],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  collectionId?: number | typeof ERRORS_COLLECTION_ID,
  fixedDirection?: LanguagePair,
  questionType?: 'spelling' | 'match-pairs',
  recentGenerators: GeneratorType[] = [],
): Promise<LegacyQuestion | SpellingQuestion | MatchPairsQuestion | null> {
  // Для коллекции ошибок используем специальный пул
  const pool = collectionId === ERRORS_COLLECTION_ID
    ? await getErrorsPool(userId)
    : await getQuizPool(userId, collectionId);
  const totalPool = pool.meaningIds.length + pool.customWords.length;

  if (totalPool === 0) {
    // Для коллекции ошибок — возвращаем null (все ошибки пройдены)
    if (collectionId === ERRORS_COLLECTION_ID) return null;
    return generateRandom(excludeMeaningIds, langPair, fixedDirection);
  }

  // SRS-фильтрация для системных слов
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { repeatMastered: true },
  });
  const repeatMastered = user?.repeatMastered ?? false;

  const now = new Date();
  const skipSrsTimer = collectionId === ERRORS_COLLECTION_ID;
  let reviewReady: number[] = [];
  let unseen: number[] = [];

  if (pool.meaningIds.length > 0) {
    const progressRows = await db
      .select({
        meaningId: userWordProgress.meaningId,
        srsStage: userWordProgress.srsStage,
        nextReviewAt: userWordProgress.nextReviewAt,
      })
      .from(userWordProgress)
      .where(
        and(
          eq(userWordProgress.userId, userId),
          inArray(userWordProgress.meaningId, pool.meaningIds),
        ),
      );

    const progressMap = new Map(progressRows.map((p) => [p.meaningId, p]));

    for (const id of pool.meaningIds) {
      const progress = progressMap.get(id);
      if (!progress) {
        unseen.push(id);
      } else if (progress.srsStage >= LEARNED_PROGRESS && !repeatMastered) {
        // выученное — пропускаем
      } else if (skipSrsTimer || !progress.nextReviewAt || progress.nextReviewAt <= now) {
        reviewReady.push(id);
      }
      // nextReviewAt > now — ещё в таймауте, пропускаем (кроме ошибок)
    }
  }

  // SRS-фильтрация для кастомных слов
  let customReviewReady: CustomWordForQuiz[] = [];
  let customUnseen: CustomWordForQuiz[] = [];

  if (pool.customWords.length > 0) {
    const customIds = pool.customWords.map((w) => w.id);
    const customProgressRows = await db
      .select({
        customWordId: userCustomWordProgress.customWordId,
        srsStage: userCustomWordProgress.srsStage,
        nextReviewAt: userCustomWordProgress.nextReviewAt,
      })
      .from(userCustomWordProgress)
      .where(
        and(
          eq(userCustomWordProgress.userId, userId),
          inArray(userCustomWordProgress.customWordId, customIds),
        ),
      );

    const customProgressMap = new Map(customProgressRows.map((p) => [p.customWordId, p]));

    for (const cw of pool.customWords) {
      const progress = customProgressMap.get(cw.id);
      if (!progress) {
        customUnseen.push(cw);
      } else if (progress.srsStage >= LEARNED_PROGRESS && !repeatMastered) {
        // выученное — пропускаем
      } else if (skipSrsTimer || !progress.nextReviewAt || progress.nextReviewAt <= now) {
        customReviewReady.push(cw);
      }
      // nextReviewAt > now — ещё в таймауте, пропускаем (кроме ошибок)
    }
  }

  // Исключаем только конкретные показанные meaningId (без siblings),
  // чтобы полисемичные слова могли показать другое значение
  const expandedExclude = new Set(excludeMeaningIds);

  // Фильтруем уже показанные
  const availableReview = reviewReady.filter((id) => !expandedExclude.has(id));
  const availableUnseen = unseen.filter((id) => !expandedExclude.has(id));
  const srsFilteredCustom = [...customReviewReady, ...customUnseen];
  const availableCustom = srsFilteredCustom.filter((w) => !expandedExclude.has(-w.id));

  // Если всё исчерпано — сбрасываем exclude
  const finalReview = availableReview.length > 0 ? availableReview : reviewReady;
  const finalUnseen = availableUnseen.length > 0 ? availableUnseen : unseen;
  const customWords = availableCustom.length > 0 ? availableCustom : srsFilteredCustom;

  // Выбираем между review/unseen с весами 70/30
  let meaningIds: number[];
  if (finalReview.length > 0 && finalUnseen.length > 0) {
    meaningIds = Math.random() < 0.7 ? finalReview : finalUnseen;
  } else {
    meaningIds = finalReview.length > 0 ? finalReview : finalUnseen;
  }
  const totalAvailable = meaningIds.length + customWords.length;

  // Случайно выбираем источник (взвешенно по количеству)
  const useCustom = totalAvailable > 0 && Math.random() < customWords.length / totalAvailable;

  // ─── Явный выбор генератора (ручной режим) ────────────────────────────
  if (questionType === 'spelling') {
    return generateSpellingQuestion(customWords, meaningIds, useCustom);
  }

  if (questionType === 'match-pairs') {
    return generateMatchPairsFromPool(meaningIds, customWords);
  }

  if (fixedDirection) {
    return generateMultipleChoiceQuestion(customWords, meaningIds, useCustom, pool.customWords, langPair, fixedDirection);
  }

  // ─── Авто-ротация генераторов ─────────────────────────────────────────
  // Match-pairs — pool-level генератор, проверяем ДО выбора одного слова
  const canMatchPairs = totalAvailable >= 3;
  const applicablePool = getApplicablePoolGenerators(canMatchPairs);
  const poolGenerator = applicablePool.length > 0
    ? pickGenerator([...getApplicableGenerators('dummy'), ...applicablePool], recentGenerators)
    : null;

  if (poolGenerator === 'match-pairs') {
    const result = await generateMatchPairsFromPool(meaningIds, customWords);
    if (result) return result;
    // Fallback — продолжаем обычную логику
  }

  // Сначала выбираем слово, потом определяем подходящие генераторы
  if (useCustom && customWords.length > 0) {
    const correct = customWords[Math.floor(Math.random() * customWords.length)]!;
    const applicable = getApplicableGenerators(correct.wordText);
    const generator = pickGenerator(applicable, recentGenerators);

    if (generator === 'spelling') {
      const result = generateSpellingFromCustomWord(correct);
      if (result) return result;
    }
    return generateFromCustomWord(correct, pool.customWords, langPair, generator === 'en-ru' ? 'en-ru' : 'ru-en');
  }

  if (meaningIds.length === 0) {
    if (customWords.length > 0) {
      const correct = customWords[Math.floor(Math.random() * customWords.length)]!;
      const applicable = getApplicableGenerators(correct.wordText);
      const generator = pickGenerator(applicable, recentGenerators);

      if (generator === 'spelling') {
        const result = generateSpellingFromCustomWord(correct);
        if (result) return result;
      }
      return generateFromCustomWord(correct, pool.customWords, langPair, generator === 'en-ru' ? 'en-ru' : 'ru-en');
    }
    return null;
  }

  const candidates = await db.query.wordMeanings.findMany({
    where: inArray(wordMeanings.id, meaningIds),
    with: { word: true },
    limit: 1,
    orderBy: sql`RANDOM()`,
  });

  if (candidates.length === 0) return null;

  const correct = candidates[0]! as PooledMeaning;
  const englishWord = correct.word.lemma ?? correct.word.text;
  const applicable = getApplicableGenerators(englishWord);
  const generator = pickGenerator(applicable, recentGenerators);

  if (generator === 'spelling') {
    const result = generateSpellingFromMeaning(correct);
    if (result) return result;
    // Fallback на multiple-choice если spelling не удался
  }

  return generateFromMeaning(correct, langPair, generator === 'en-ru' ? 'en-ru' : 'ru-en');
}

// ─── Double XP Wrapper ──────────────────────────────────────────────────────

function maybeApplyDoubleXp(
  question: LegacyQuestion | SpellingQuestion | MatchPairsQuestion | null,
  userId: number,
): typeof question {
  if (!question) return null;
  if (Math.random() >= DOUBLE_XP_CHANCE) return question;

  const questionType = ('type' in question && question.type) ? question.type : 'multiple-choice';
  const timeLimitMs = DOUBLE_XP_TIME_LIMITS[questionType];
  if (!timeLimitMs) return question;

  const generatedAt = Date.now();

  if (questionType === 'match-pairs' && 'pairs' in question) {
    const meaningIds = question.pairs.map(p => p.meaningId);
    setDoubleXp(makeMatchPairsKey(userId, meaningIds), { generatedAt, timeLimitMs });
  } else if ('meaningId' in question) {
    setDoubleXp(makeKey(userId, question.meaningId), { generatedAt, timeLimitMs });
  }

  return { ...question, doubleXpTimeLimitMs: timeLimitMs };
}

// ─── Helper: определяет подходящие генераторы для слова ──────────────────────

function getApplicableGenerators(englishWord: string): GeneratorType[] {
  const generators: GeneratorType[] = ['en-ru', 'ru-en'];
  if (canGenerateSpelling(englishWord)) {
    generators.push('spelling');
  }
  return generators;
}

/** Генераторы, работающие на уровне пула (не одного слова) */
function getApplicablePoolGenerators(canMatchPairs: boolean): GeneratorType[] {
  const generators: GeneratorType[] = [];
  if (canMatchPairs) generators.push('match-pairs');
  return generators;
}

// ─── Helper: генерация spelling-вопроса ─────────────────────────────────────

async function generateSpellingQuestion(
  customWords: CustomWordForQuiz[],
  meaningIds: number[],
  useCustom: boolean,
): Promise<SpellingQuestion | null> {
  if (useCustom && customWords.length > 0) {
    const suitableCustom = customWords.filter((w) => canGenerateSpelling(w.wordText));
    if (suitableCustom.length > 0) {
      const correct = suitableCustom[Math.floor(Math.random() * suitableCustom.length)]!;
      return generateSpellingFromCustomWord(correct);
    }
  }

  if (meaningIds.length > 0) {
    const candidates = await db.query.wordMeanings.findMany({
      where: inArray(wordMeanings.id, meaningIds),
      with: { word: true },
      orderBy: sql`RANDOM()`,
    });

    for (const candidate of candidates) {
      const word = (candidate as PooledMeaning).word.lemma ?? (candidate as PooledMeaning).word.text;
      if (canGenerateSpelling(word)) {
        return generateSpellingFromMeaning(candidate as PooledMeaning);
      }
    }
  }

  return null;
}

// ─── Helper: генерация multiple-choice вопроса ──────────────────────────────

function generateMultipleChoiceQuestion(
  customWords: CustomWordForQuiz[],
  meaningIds: number[],
  useCustom: boolean,
  allCustomWords: CustomWordForQuiz[],
  langPair: LanguagePair,
  fixedDirection?: LanguagePair,
): Promise<LegacyQuestion | null> {
  if (useCustom && customWords.length > 0) {
    const correct = customWords[Math.floor(Math.random() * customWords.length)]!;
    return generateFromCustomWord(correct, allCustomWords, langPair, fixedDirection);
  }

  if (meaningIds.length === 0) {
    if (customWords.length > 0) {
      const correct = customWords[Math.floor(Math.random() * customWords.length)]!;
      return generateFromCustomWord(correct, allCustomWords, langPair, fixedDirection);
    }
    return Promise.resolve(null);
  }

  return (async () => {
    const candidates = await db.query.wordMeanings.findMany({
      where: inArray(wordMeanings.id, meaningIds),
      with: { word: true },
      limit: 1,
      orderBy: sql`RANDOM()`,
    });

    if (candidates.length === 0) return null;

    const correct = candidates[0]!;
    return generateFromMeaning(correct as PooledMeaning, langPair, fixedDirection);
  })();
}

// ─── Answer Recording ────────────────────────────────────────────────────────

export async function recordAnswer(
  sessionId: number,
  meaningId: number,
  selectedMeaningId: number | null,
  answerTimeMs: number,
) {
  // Проверяем правильность
  const correctMeaning = await db.query.wordMeanings.findFirst({
    where: eq(wordMeanings.id, meaningId),
  });

  let isCorrect = false;
  if (selectedMeaningId !== null && correctMeaning) {
    const selected = await db.query.wordMeanings.findFirst({
      where: eq(wordMeanings.id, selectedMeaningId),
    });
    const validTranslations = new Set(getAllTranslations(correctMeaning));
    isCorrect = selected ? validTranslations.has(selected.translation) : false;
  }

  await db
    .insert(quizAnswers)
    .values({ sessionId, meaningId, selectedMeaningId, isCorrect, answerTimeMs })
    .returning();

  // Обновляем счётчики сессии
  await db
    .update(quizSessions)
    .set({
      totalCount: sql`${quizSessions.totalCount} + 1`,
      correctCount: isCorrect ? sql`${quizSessions.correctCount} + 1` : quizSessions.correctCount,
      score: isCorrect ? sql`${quizSessions.score} + ${XP_CORRECT_ANSWER}` : quizSessions.score,
    })
    .where(eq(quizSessions.id, sessionId));

  // Определяем, есть ли ещё вопросы
  const session = await db.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
  });

  const isFinished = (session?.totalCount ?? 0) >= QUESTIONS_PER_SESSION;

  return { isCorrect, correctTranslation: correctMeaning?.translation ?? '', isFinished };
}

export async function recordInfiniteAnswer(
  userId: number,
  meaningId: number,
  selectedMeaningId: number | null,
  streak: number = 0,
  doubleXpClaimed: boolean = false,
) {
  const isCustom = meaningId < 0;
  const realId = Math.abs(meaningId);

  let correctTranslation = '';
  let isCorrect = false;

  if (isCustom) {
    // Кастомное слово — проверяем по selectedMeaningId (тоже отрицательный)
    const customWord = await db.query.userCustomWords.findFirst({
      where: eq(userCustomWords.id, realId),
    });
    correctTranslation = customWord?.translation ?? '';
    isCorrect = selectedMeaningId === meaningId;

    // SRS-прогресс для кастомных слов
    const [existing] = await db
      .select()
      .from(userCustomWordProgress)
      .where(and(eq(userCustomWordProgress.userId, userId), eq(userCustomWordProgress.customWordId, realId)))
      .limit(1);

    if (existing) {
      const srs = computeNextReview({
        learningProgress: existing.srsStage,
        hasPenalty: existing.hasPenalty,
        reviewStage: existing.reviewStage,
      }, isCorrect);
      await db
        .update(userCustomWordProgress)
        .set({
          correctCount: isCorrect ? sql`${userCustomWordProgress.correctCount} + 1` : userCustomWordProgress.correctCount,
          incorrectCount: isCorrect ? 0 : sql`${userCustomWordProgress.incorrectCount} + 1`,
          srsStage: srs.newProgress,
          hasPenalty: srs.newPenalty,
          reviewStage: srs.newReviewStage,
          nextReviewAt: srs.nextReviewAt,
          masteredAt: srs.isLearned ? new Date() : existing.masteredAt,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userCustomWordProgress.id, existing.id));
    } else {
      const srs = computeNextReview({ learningProgress: 0, hasPenalty: false, reviewStage: 0 }, isCorrect);
      await db.insert(userCustomWordProgress).values({
        userId,
        customWordId: realId,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        srsStage: srs.newProgress,
        hasPenalty: srs.newPenalty,
        reviewStage: srs.newReviewStage,
        nextReviewAt: srs.nextReviewAt,
      });
    }
  } else {
    const correctMeaning = await db.query.wordMeanings.findFirst({
      where: eq(wordMeanings.id, meaningId),
    });
    correctTranslation = correctMeaning?.translation ?? '';

    if (selectedMeaningId !== null && correctMeaning) {
      if (selectedMeaningId > 0) {
        const selected = await db.query.wordMeanings.findFirst({
          where: eq(wordMeanings.id, selectedMeaningId),
        });
        const validTranslations = new Set(getAllTranslations(correctMeaning));
        isCorrect = selected ? validTranslations.has(selected.translation) : false;
      } else {
        isCorrect = selectedMeaningId === meaningId;
      }
    }

    // Обновляем user_word_progress только для словарных слов
    const [existing] = await db
      .select()
      .from(userWordProgress)
      .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.meaningId, meaningId)))
      .limit(1);

    if (existing) {
      const srs = computeNextReview({
        learningProgress: existing.srsStage,
        hasPenalty: existing.hasPenalty,
        reviewStage: existing.reviewStage,
      }, isCorrect);
      await db
        .update(userWordProgress)
        .set({
          correctCount: isCorrect ? sql`${userWordProgress.correctCount} + 1` : userWordProgress.correctCount,
          incorrectCount: isCorrect ? 0 : sql`${userWordProgress.incorrectCount} + 1`,
          srsStage: srs.newProgress,
          hasPenalty: srs.newPenalty,
          reviewStage: srs.newReviewStage,
          nextReviewAt: srs.nextReviewAt,
          masteredAt: srs.isLearned ? new Date() : existing.masteredAt,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userWordProgress.id, existing.id));
    } else {
      const srs = computeNextReview({ learningProgress: 0, hasPenalty: false, reviewStage: 0 }, isCorrect);
      await db.insert(userWordProgress).values({
        userId,
        meaningId,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        srsStage: srs.newProgress,
        hasPenalty: srs.newPenalty,
        reviewStage: srs.newReviewStage,
        nextReviewAt: srs.nextReviewAt,
      });
    }
  }

  // Начисляем XP и LP с модификаторами streak через progression-service
  if (isCorrect) {
    // Double XP: проверяем серверный трекер
    let doubleXpApplied = false;
    if (doubleXpClaimed) {
      const key = isCustom ? makeKey(userId, meaningId) : makeKey(userId, meaningId);
      doubleXpApplied = validateAndConsume(key);
    }
    const baseXp = doubleXpApplied ? XP_CORRECT_ANSWER * DOUBLE_XP_MULTIPLIER : XP_CORRECT_ANSWER;
    const reward = await rewardCorrectAnswer(userId, streak, baseXp);

    // Загружаем дневные счётчики пользователя
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        dailyCorrectCount: true,
        dailyCorrectDate: true,
        dailyStreakMilestonesDone: true,
        dailyCorrectMilestonesDone: true,
        lastLoginDate: true,
      },
    });

    const now = new Date();
    const todayStart = getMskTodayStart(now);

    // Обновляем streak дней (если первый ответ за день)
    let isNewDay = !user?.lastLoginDate;
    if (user?.lastLoginDate) {
      const lastLogin = toMskDayStart(user.lastLoginDate);
      isNewDay = lastLogin.getTime() !== todayStart.getTime();
    }

    let streakGemsFromDay = 0;
    if (isNewDay) {
      const streakResult = await updateStreakDays(userId);
      streakGemsFromDay = streakResult.gemsEarned;
    }

    // Проверяем, нужно ли сбросить дневные счётчики
    let dailyCorrectCount = user?.dailyCorrectCount ?? 0;
    let streakMilestonesDone = new Set((user?.dailyStreakMilestonesDone ?? '').split(',').filter(Boolean).map(Number));
    let correctMilestonesDone = new Set((user?.dailyCorrectMilestonesDone ?? '').split(',').filter(Boolean).map(Number));

    if (user?.dailyCorrectDate) {
      const lastDate = toMskDayStart(user.dailyCorrectDate);
      if (lastDate.getTime() !== todayStart.getTime()) {
        dailyCorrectCount = 0;
        streakMilestonesDone = new Set();
        correctMilestonesDone = new Set();
      }
    } else {
      dailyCorrectCount = 0;
      streakMilestonesDone = new Set();
      correctMilestonesDone = new Set();
    }

    let milestoneGems = 0;

    // Гемы за мильники стрика ответов подряд (разово в день)
    const newStreak = streak + 1;
    for (const [threshold, gems] of ANSWER_STREAK_MILESTONES) {
      if (newStreak >= threshold && !streakMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        streakMilestonesDone.add(threshold);
      }
    }

    // Инкрементируем дневной счётчик правильных ответов
    const newDailyCorrectCount = dailyCorrectCount + 1;

    // Гемы за суммарные правильные ответы за день (разово в день)
    for (const [threshold, gems] of DAILY_CORRECT_MILESTONES) {
      if (newDailyCorrectCount >= threshold && !correctMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        correctMilestonesDone.add(threshold);
      }
    }

    // Сохраняем дневные счётчики и обновляем рекорд стрика ответов
    await db
      .update(users)
      .set({
        dailyCorrectCount: newDailyCorrectCount,
        dailyCorrectDate: todayStart,
        dailyStreakMilestonesDone: [...streakMilestonesDone].join(','),
        dailyCorrectMilestonesDone: [...correctMilestonesDone].join(','),
        bestAnswerStreak: sql`GREATEST(${users.bestAnswerStreak}, ${newStreak})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      isCorrect,
      correctTranslation,
      xpEarned: reward.xpEarned,
      xpModifier: reward.xpModifier,
      totalXp: reward.totalXp,
      level: reward.level,
      levelUp: reward.levelUp,
      lpEarned: reward.lpEarned,
      lpModifier: reward.lpModifier,
      totalLp: reward.totalLp,
      gemsEarned: reward.gemsEarned + milestoneGems + streakGemsFromDay,
      dailyCorrectCount: newDailyCorrectCount,
      doubleXpApplied,
    };
  }

  return {
    isCorrect,
    correctTranslation,
    xpEarned: 0,
    totalXp: undefined,
    level: undefined,
    levelUp: undefined,
    lpEarned: 0,
    totalLp: undefined,
    gemsEarned: 0,
    dailyCorrectCount: undefined,
  };
}

// ─── Match-Pairs Answer ─────────────────────────────────────────────────────

export async function recordMatchPairsAnswer(
  userId: number,
  results: Array<{ meaningId: number; isCorrect: boolean }>,
  streak: number = 0,
  doubleXpClaimed: boolean = false,
) {
  // Double XP: проверяем серверный трекер один раз для всех пар
  let doubleXpApplied = false;
  if (doubleXpClaimed) {
    const meaningIds = results.map(r => r.meaningId);
    const key = makeMatchPairsKey(userId, meaningIds);
    doubleXpApplied = validateAndConsume(key);
  }
  const baseXp = doubleXpApplied ? XP_CORRECT_ANSWER * DOUBLE_XP_MULTIPLIER : XP_CORRECT_ANSWER;

  let totalXpEarned = 0;
  let totalLpEarned = 0;
  let lastXpModifier: number | undefined;
  let lastLpModifier: number | undefined;
  let totalXp: number | undefined;
  let totalLp: number | undefined;
  let level: number | undefined;
  let levelUp: number | undefined;
  let totalGemsEarned = 0;
  let correctCount = 0;
  let currentStreak = streak;

  for (const { meaningId, isCorrect } of results) {
    const isCustom = meaningId < 0;
    const realId = Math.abs(meaningId);

    // Обновляем SRS-прогресс
    if (isCustom) {
      const [existing] = await db
        .select()
        .from(userCustomWordProgress)
        .where(and(eq(userCustomWordProgress.userId, userId), eq(userCustomWordProgress.customWordId, realId)))
        .limit(1);

      if (existing) {
        const srs = computeNextReview({
          learningProgress: existing.srsStage,
          hasPenalty: existing.hasPenalty,
          reviewStage: existing.reviewStage,
        }, isCorrect);
        await db
          .update(userCustomWordProgress)
          .set({
            correctCount: isCorrect ? sql`${userCustomWordProgress.correctCount} + 1` : userCustomWordProgress.correctCount,
            incorrectCount: isCorrect ? 0 : sql`${userCustomWordProgress.incorrectCount} + 1`,
            srsStage: srs.newProgress,
            hasPenalty: srs.newPenalty,
            reviewStage: srs.newReviewStage,
            nextReviewAt: srs.nextReviewAt,
            masteredAt: srs.isLearned ? new Date() : existing.masteredAt,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userCustomWordProgress.id, existing.id));
      } else {
        const srs = computeNextReview({ learningProgress: 0, hasPenalty: false, reviewStage: 0 }, isCorrect);
        await db.insert(userCustomWordProgress).values({
          userId,
          customWordId: realId,
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          srsStage: srs.newProgress,
          hasPenalty: srs.newPenalty,
          reviewStage: srs.newReviewStage,
          nextReviewAt: srs.nextReviewAt,
        });
      }
    } else {
      const [existing] = await db
        .select()
        .from(userWordProgress)
        .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.meaningId, meaningId)))
        .limit(1);

      if (existing) {
        const srs = computeNextReview({
          learningProgress: existing.srsStage,
          hasPenalty: existing.hasPenalty,
          reviewStage: existing.reviewStage,
        }, isCorrect);
        await db
          .update(userWordProgress)
          .set({
            correctCount: isCorrect ? sql`${userWordProgress.correctCount} + 1` : userWordProgress.correctCount,
            incorrectCount: isCorrect ? 0 : sql`${userWordProgress.incorrectCount} + 1`,
            srsStage: srs.newProgress,
            hasPenalty: srs.newPenalty,
            reviewStage: srs.newReviewStage,
            nextReviewAt: srs.nextReviewAt,
            masteredAt: srs.isLearned ? new Date() : existing.masteredAt,
            lastSeenAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(userWordProgress.id, existing.id));
      } else {
        const srs = computeNextReview({ learningProgress: 0, hasPenalty: false, reviewStage: 0 }, isCorrect);
        await db.insert(userWordProgress).values({
          userId,
          meaningId,
          correctCount: isCorrect ? 1 : 0,
          incorrectCount: isCorrect ? 0 : 1,
          srsStage: srs.newProgress,
          hasPenalty: srs.newPenalty,
          reviewStage: srs.newReviewStage,
          nextReviewAt: srs.nextReviewAt,
        });
      }
    }

    // Награды за правильный ответ
    if (isCorrect) {
      correctCount++;
      const reward = await rewardCorrectAnswer(userId, currentStreak, baseXp);
      totalXpEarned += reward.xpEarned;
      totalLpEarned += reward.lpEarned;
      lastXpModifier = reward.xpModifier;
      lastLpModifier = reward.lpModifier;
      totalXp = reward.totalXp;
      totalLp = reward.totalLp;
      level = reward.level;
      if (reward.levelUp) levelUp = reward.levelUp;
      totalGemsEarned += reward.gemsEarned;
      currentStreak++;
    } else {
      currentStreak = 0;
    }
  }

  // Обновляем дневные счётчики (один раз за весь batch)
  if (correctCount > 0) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        dailyCorrectCount: true,
        dailyCorrectDate: true,
        dailyStreakMilestonesDone: true,
        dailyCorrectMilestonesDone: true,
        lastLoginDate: true,
      },
    });

    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let isNewDay = !user?.lastLoginDate;
    if (user?.lastLoginDate) {
      const lastLogin = new Date(
        Date.UTC(user.lastLoginDate.getUTCFullYear(), user.lastLoginDate.getUTCMonth(), user.lastLoginDate.getUTCDate())
      );
      isNewDay = lastLogin.getTime() !== todayStart.getTime();
    }

    let streakGemsFromDay = 0;
    if (isNewDay) {
      const streakResult = await updateStreakDays(userId);
      streakGemsFromDay = streakResult.gemsEarned;
    }

    let dailyCorrectCount = user?.dailyCorrectCount ?? 0;
    let streakMilestonesDone = new Set((user?.dailyStreakMilestonesDone ?? '').split(',').filter(Boolean).map(Number));
    let correctMilestonesDone = new Set((user?.dailyCorrectMilestonesDone ?? '').split(',').filter(Boolean).map(Number));

    if (user?.dailyCorrectDate) {
      const lastDate = toMskDayStart(user.dailyCorrectDate);
      if (lastDate.getTime() !== todayStart.getTime()) {
        dailyCorrectCount = 0;
        streakMilestonesDone = new Set();
        correctMilestonesDone = new Set();
      }
    } else {
      dailyCorrectCount = 0;
      streakMilestonesDone = new Set();
      correctMilestonesDone = new Set();
    }

    let milestoneGems = 0;

    // Стрик ответов
    const finalStreak = currentStreak;
    for (const [threshold, gems] of ANSWER_STREAK_MILESTONES) {
      if (finalStreak >= threshold && !streakMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        streakMilestonesDone.add(threshold);
      }
    }

    const newDailyCorrectCount = dailyCorrectCount + correctCount;

    for (const [threshold, gems] of DAILY_CORRECT_MILESTONES) {
      if (newDailyCorrectCount >= threshold && !correctMilestonesDone.has(threshold)) {
        await addGems(userId, gems);
        milestoneGems += gems;
        correctMilestonesDone.add(threshold);
      }
    }

    await db
      .update(users)
      .set({
        dailyCorrectCount: newDailyCorrectCount,
        dailyCorrectDate: todayStart,
        dailyStreakMilestonesDone: [...streakMilestonesDone].join(','),
        dailyCorrectMilestonesDone: [...correctMilestonesDone].join(','),
        bestAnswerStreak: sql`GREATEST(${users.bestAnswerStreak}, ${finalStreak})`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    totalGemsEarned += milestoneGems + streakGemsFromDay;
  }

  return {
    correctCount,
    totalCount: results.length,
    totalXpEarned,
    xpModifier: lastXpModifier,
    totalLpEarned,
    lpModifier: lastLpModifier,
    totalXp,
    totalLp,
    level,
    levelUp,
    gemsEarned: totalGemsEarned,
    doubleXpApplied,
  };
}

// ─── Session Completion ──────────────────────────────────────────────────────

export async function finishSession(sessionId: number, userId: number) {
  const session = await db.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
  });

  if (!session) throw new Error('Сессия не найдена');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new Error('Пользователь не найден');

  // Обновляем streak дней
  const streakResult = await updateStreakDays(userId);

  // Начисляем награды через progression-service
  const result = await rewardQuizSessionComplete(
    userId,
    session.correctCount,
    streakResult.streakDays > user.streakDays ? streakResult.streakDays : 0, // LP за streak только при увеличении
  );

  // Обновляем сессию
  await db
    .update(quizSessions)
    .set({ xpEarned: result.xpEarned, finishedAt: new Date() })
    .where(eq(quizSessions.id, sessionId));

  return {
    correctCount: session.correctCount,
    totalCount: session.totalCount,
    xpEarned: result.xpEarned,
    streak: streakResult.streakDays,
    totalXp: result.totalXp,
    level: result.level,
    gemsEarned: streakResult.gemsEarned + result.gemsEarned,
    freezeUsed: streakResult.freezeUsed,
  };
}
