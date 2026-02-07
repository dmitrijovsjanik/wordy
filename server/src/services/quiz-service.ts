import { eq, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordMeanings, quizSessions, quizAnswers, users, userWordProgress, userCustomWords, userCustomWordProgress } from '../db/schema.js';
import { getQuizPool, getErrorsPool, type CustomWordForQuiz } from './collection-service.js';
import { ERRORS_COLLECTION_ID } from '../config/errors-config.js';
import { computeNextReview, MASTERED_STAGE } from './srs-service.js';
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
import type { PooledMeaning, LegacyQuestion, LanguagePair, SpellingQuestion, GeneratorType } from './game/types.js';
import { DEFAULT_LANG_PAIR, pickGenerator } from './game/types.js';

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
  questionType?: 'spelling',
  recentGenerators: GeneratorType[] = [],
): Promise<LegacyQuestion | SpellingQuestion | null> {
  // Для коллекции ошибок используем специальный пул
  const pool = collectionId === ERRORS_COLLECTION_ID
    ? await getErrorsPool(userId)
    : await getQuizPool(userId, collectionId);
  const totalPool = pool.meaningIds.length + pool.customWords.length;

  if (totalPool === 0) {
    return generateRandom(excludeMeaningIds, langPair, fixedDirection);
  }

  // SRS-фильтрация для системных слов
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { repeatMastered: true },
  });
  const repeatMastered = user?.repeatMastered ?? false;

  const now = new Date();
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
      } else if (progress.srsStage >= MASTERED_STAGE && !repeatMastered) {
        // выученное — пропускаем
      } else if (!progress.nextReviewAt || progress.nextReviewAt <= now) {
        reviewReady.push(id);
      }
      // nextReviewAt > now — ещё в таймауте, пропускаем
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
      } else if (progress.srsStage >= MASTERED_STAGE && !repeatMastered) {
        // выученное — пропускаем
      } else if (!progress.nextReviewAt || progress.nextReviewAt <= now) {
        customReviewReady.push(cw);
      }
      // nextReviewAt > now — ещё в таймауте, пропускаем
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

  if (fixedDirection) {
    return generateMultipleChoiceQuestion(customWords, meaningIds, useCustom, pool.customWords, langPair, fixedDirection);
  }

  // ─── Авто-ротация генераторов ─────────────────────────────────────────
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

// ─── Helper: определяет подходящие генераторы для слова ──────────────────────

function getApplicableGenerators(englishWord: string): GeneratorType[] {
  const generators: GeneratorType[] = ['en-ru', 'ru-en'];
  if (canGenerateSpelling(englishWord)) {
    generators.push('spelling');
  }
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
      const srs = computeNextReview(existing.srsStage, isCorrect);
      await db
        .update(userCustomWordProgress)
        .set({
          correctCount: isCorrect ? sql`${userCustomWordProgress.correctCount} + 1` : userCustomWordProgress.correctCount,
          incorrectCount: isCorrect ? userCustomWordProgress.incorrectCount : sql`${userCustomWordProgress.incorrectCount} + 1`,
          srsStage: srs.newStage,
          nextReviewAt: srs.nextReviewAt,
          masteredAt: srs.isMastered ? new Date() : (srs.newStage < MASTERED_STAGE ? null : existing.masteredAt),
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userCustomWordProgress.id, existing.id));
    } else {
      const srs = computeNextReview(0, isCorrect);
      await db.insert(userCustomWordProgress).values({
        userId,
        customWordId: realId,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        srsStage: srs.newStage,
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
      const srs = computeNextReview(existing.srsStage, isCorrect);
      await db
        .update(userWordProgress)
        .set({
          correctCount: isCorrect ? sql`${userWordProgress.correctCount} + 1` : userWordProgress.correctCount,
          incorrectCount: isCorrect ? userWordProgress.incorrectCount : sql`${userWordProgress.incorrectCount} + 1`,
          srsStage: srs.newStage,
          nextReviewAt: srs.nextReviewAt,
          masteredAt: srs.isMastered ? new Date() : (srs.newStage < MASTERED_STAGE ? null : existing.masteredAt),
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userWordProgress.id, existing.id));
    } else {
      const srs = computeNextReview(0, isCorrect);
      await db.insert(userWordProgress).values({
        userId,
        meaningId,
        correctCount: isCorrect ? 1 : 0,
        incorrectCount: isCorrect ? 0 : 1,
        srsStage: srs.newStage,
        nextReviewAt: srs.nextReviewAt,
      });
    }
  }

  // Начисляем XP и LP с модификаторами streak через progression-service
  if (isCorrect) {
    const reward = await rewardCorrectAnswer(userId, streak);

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
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Обновляем streak дней (если первый ответ за день)
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

    // Проверяем, нужно ли сбросить дневные счётчики
    let dailyCorrectCount = user?.dailyCorrectCount ?? 0;
    let streakMilestonesDone = new Set((user?.dailyStreakMilestonesDone ?? '').split(',').filter(Boolean).map(Number));
    let correctMilestonesDone = new Set((user?.dailyCorrectMilestonesDone ?? '').split(',').filter(Boolean).map(Number));

    if (user?.dailyCorrectDate) {
      const lastDate = new Date(
        Date.UTC(user.dailyCorrectDate.getUTCFullYear(), user.dailyCorrectDate.getUTCMonth(), user.dailyCorrectDate.getUTCDate())
      );
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

    // Сохраняем дневные счётчики
    await db
      .update(users)
      .set({
        dailyCorrectCount: newDailyCorrectCount,
        dailyCorrectDate: todayStart,
        dailyStreakMilestonesDone: [...streakMilestonesDone].join(','),
        dailyCorrectMilestonesDone: [...correctMilestonesDone].join(','),
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
