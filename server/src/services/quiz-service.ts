import { eq, ne, and, sql, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordMeanings, quizSessions, quizAnswers, users, userWordProgress, userCustomWords, userCustomWordProgress } from '../db/schema.js';
import { getQuizPool, type CustomWordForQuiz } from './collection-service.js';
import { computeNextReview, MASTERED_STAGE } from './srs-service.js';
import { type LanguagePair, DEFAULT_LANG_PAIR, reversePair } from '../types/language.js';

const QUESTIONS_PER_SESSION = 10;
const XP_PER_CORRECT = 10;
const XP_STREAK_BONUS = 5;

type Question = {
  meaningId: number;
  word: string;
  correctTranslation: string;
  options: string[];
  direction: string;
};

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function randomDirection(pair: LanguagePair = DEFAULT_LANG_PAIR): string {
  return Math.random() < 0.5 ? pair : reversePair(pair);
}

function getAllTranslations(meaning: { translation: string; alternativeTranslations: string[] | null }): string[] {
  return [meaning.translation, ...(meaning.alternativeTranslations ?? [])];
}

export async function createSession(userId: number) {
  const [session] = await db
    .insert(quizSessions)
    .values({ userId, type: 'solo' })
    .returning();
  return session!;
}

export async function generateQuestion(excludeMeaningIds: number[] = [], langPair: LanguagePair = DEFAULT_LANG_PAIR): Promise<Question | null> {
  // Выбираем случайный meaning для вопроса
  const condition = excludeMeaningIds.length > 0
    ? sql`${wordMeanings.id} NOT IN (${sql.join(excludeMeaningIds.map(id => sql`${id}`), sql`, `)})`
    : undefined;

  const candidates = await db.query.wordMeanings.findMany({
    where: condition,
    with: { word: true },
    limit: 1,
    orderBy: sql`RANDOM()`,
  });

  if (candidates.length === 0) return null;

  const correct = candidates[0]!;

  // Все переводы правильного значения (primary + alternatives)
  const correctTranslations = getAllTranslations(correct);
  const correctTranslationsSet = new Set(correctTranslations);

  // 3 неправильных варианта той же сложности, не совпадающие ни с одним переводом правильного
  const wrongOptions = await db.query.wordMeanings.findMany({
    where: and(
      ne(wordMeanings.id, correct.id),
      eq(wordMeanings.difficulty, correct.difficulty),
      sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
    ),
    with: { word: true },
    limit: 3,
    orderBy: sql`RANDOM()`,
  });

  // Если мало вариантов той же сложности, берём любые
  if (wrongOptions.length < 3) {
    const moreOptions = await db.query.wordMeanings.findMany({
      where: and(
        ne(wordMeanings.id, correct.id),
        sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
        wrongOptions.length > 0
          ? sql`${wordMeanings.id} NOT IN (${sql.join(wrongOptions.map(o => sql`${o.id}`), sql`, `)})`
          : undefined,
      ),
      with: { word: true },
      limit: 3 - wrongOptions.length,
      orderBy: sql`RANDOM()`,
    });
    wrongOptions.push(...moreOptions);
  }

  // Фильтруем варианты, чей перевод совпадает с альтернативным переводом правильного
  const filteredWrong = wrongOptions.filter(o => !correctTranslationsSet.has(o.translation));

  const direction = randomDirection(langPair);
  const isForward = direction === langPair;

  if (isForward) {
    const options = shuffle([correct.translation, ...filteredWrong.map(o => o.translation)]);
    return {
      meaningId: correct.id,
      word: correct.word.text,
      correctTranslation: correct.translation,
      options,
      direction,
    };
  } else {
    const options = shuffle([correct.word.text, ...filteredWrong.map(o => o.word.text)]);
    return {
      meaningId: correct.id,
      word: correct.translation,
      correctTranslation: correct.word.text,
      options,
      direction,
    };
  }
}

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
      score: isCorrect ? sql`${quizSessions.score} + ${XP_PER_CORRECT}` : quizSessions.score,
    })
    .where(eq(quizSessions.id, sessionId));

  // Определяем, есть ли ещё вопросы
  const session = await db.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
  });

  const isFinished = (session?.totalCount ?? 0) >= QUESTIONS_PER_SESSION;

  return { isCorrect, correctTranslation: correctMeaning?.translation ?? '', isFinished };
}

export async function finishSession(sessionId: number, userId: number) {
  const session = await db.query.quizSessions.findFirst({
    where: eq(quizSessions.id, sessionId),
  });

  if (!session) throw new Error('Сессия не найдена');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new Error('Пользователь не найден');

  // Подсчёт XP
  let xpEarned = session.correctCount * XP_PER_CORRECT;

  // Streak logic
  const now = new Date();
  const lastActivity = user.lastActivityAt;
  let newStreakDays = user.streakDays;

  if (lastActivity) {
    const diffMs = now.getTime() - lastActivity.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours >= 24 && diffHours < 48) {
      newStreakDays += 1;
    } else if (diffHours >= 48) {
      newStreakDays = 1;
    }
    // < 24 часов — streak не меняется (уже играли сегодня)
  } else {
    newStreakDays = 1;
  }

  xpEarned += XP_STREAK_BONUS * newStreakDays;

  const newXp = user.xp + xpEarned;
  const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

  // Обновляем сессию
  await db
    .update(quizSessions)
    .set({ xpEarned, finishedAt: now })
    .where(eq(quizSessions.id, sessionId));

  // Обновляем пользователя
  await db
    .update(users)
    .set({
      xp: newXp,
      level: newLevel,
      streakDays: newStreakDays,
      lastActivityAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  return {
    correctCount: session.correctCount,
    totalCount: session.totalCount,
    xpEarned,
    streak: newStreakDays,
    totalXp: newXp,
    level: newLevel,
  };
}

export async function getAnsweredMeaningIds(sessionId: number): Promise<number[]> {
  const answers = await db.query.quizAnswers.findMany({
    where: eq(quizAnswers.sessionId, sessionId),
    columns: { meaningId: true },
  });
  return answers.map(a => a.meaningId);
}

// ─── Infinite Quiz ──────────────────────────────────────────────────────────

export async function generateQuestionFromPool(
  userId: number,
  excludeMeaningIds: number[] = [],
  langPair: LanguagePair = DEFAULT_LANG_PAIR,
  collectionId?: number,
): Promise<Question | null> {
  const pool = await getQuizPool(userId, collectionId);
  const totalPool = pool.meaningIds.length + pool.customWords.length;

  if (totalPool === 0) {
    return generateQuestion(excludeMeaningIds, langPair);
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

  // Расширяем exclude: для каждого показанного meaningId исключаем все значения того же слова (полисемия)
  let expandedExclude = new Set(excludeMeaningIds);
  const positiveMeaningIds = excludeMeaningIds.filter((id) => id > 0);
  if (positiveMeaningIds.length > 0) {
    const shownMeanings = await db
      .select({ wordId: wordMeanings.wordId })
      .from(wordMeanings)
      .where(inArray(wordMeanings.id, positiveMeaningIds));
    const wordIds = [...new Set(shownMeanings.map((m) => m.wordId))];
    if (wordIds.length > 0) {
      const siblings = await db
        .select({ id: wordMeanings.id })
        .from(wordMeanings)
        .where(inArray(wordMeanings.wordId, wordIds));
      for (const s of siblings) expandedExclude.add(s.id);
    }
  }

  // Фильтруем уже показанные (включая сиблинг-значения)
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

  if (useCustom && customWords.length > 0) {
    return generateQuestionFromCustomWord(customWords, pool.customWords, langPair);
  }

  if (meaningIds.length === 0) {
    return customWords.length > 0
      ? generateQuestionFromCustomWord(customWords, pool.customWords, langPair)
      : null;
  }

  const candidates = await db.query.wordMeanings.findMany({
    where: inArray(wordMeanings.id, meaningIds),
    with: { word: true },
    limit: 1,
    orderBy: sql`RANDOM()`,
  });

  if (candidates.length === 0) return null;

  const correct = candidates[0]!;

  // Все переводы правильного значения (primary + alternatives)
  const correctTranslations = getAllTranslations(correct);
  const correctTranslationsSet = new Set(correctTranslations);

  // 3 неправильных варианта
  const wrongOptions = await db.query.wordMeanings.findMany({
    where: and(
      ne(wordMeanings.id, correct.id),
      eq(wordMeanings.difficulty, correct.difficulty),
      sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
    ),
    with: { word: true },
    limit: 3,
    orderBy: sql`RANDOM()`,
  });

  if (wrongOptions.length < 3) {
    const moreOptions = await db.query.wordMeanings.findMany({
      where: and(
        ne(wordMeanings.id, correct.id),
        sql`${wordMeanings.translation} NOT IN (${sql.join(correctTranslations.map(t => sql`${t}`), sql`, `)})`,
        wrongOptions.length > 0
          ? sql`${wordMeanings.id} NOT IN (${sql.join(wrongOptions.map(o => sql`${o.id}`), sql`, `)})`
          : undefined,
      ),
      with: { word: true },
      limit: 3 - wrongOptions.length,
      orderBy: sql`RANDOM()`,
    });
    wrongOptions.push(...moreOptions);
  }

  const filteredWrong = wrongOptions.filter(o => !correctTranslationsSet.has(o.translation));

  const direction = randomDirection(langPair);
  const isForward = direction === langPair;

  if (isForward) {
    const options = shuffle([correct.translation, ...filteredWrong.map(o => o.translation)]);
    return {
      meaningId: correct.id,
      word: correct.word.text,
      correctTranslation: correct.translation,
      options,
      direction,
    };
  } else {
    const options = shuffle([correct.word.text, ...filteredWrong.map(o => o.word.text)]);
    return {
      meaningId: correct.id,
      word: correct.translation,
      correctTranslation: correct.word.text,
      options,
      direction,
    };
  }
}

async function generateQuestionFromCustomWord(
  candidates: CustomWordForQuiz[],
  allCustom: CustomWordForQuiz[],
  langPair: LanguagePair,
): Promise<Question | null> {
  const correct = candidates[Math.floor(Math.random() * candidates.length)]!;

  // Неправильные варианты: сначала из кастомных слов того же пула
  const otherCustom = shuffle(
    allCustom.filter((w) => w.id !== correct.id && w.translation !== correct.translation),
  );
  const wrongTranslations: string[] = otherCustom.slice(0, 3).map((w) => w.translation);

  // Если мало кастомных — добиваем из wordMeanings
  if (wrongTranslations.length < 3) {
    const dbWrong = await db.query.wordMeanings.findMany({
      where: ne(wordMeanings.translation, correct.translation),
      limit: 3 - wrongTranslations.length,
      orderBy: sql`RANDOM()`,
    });
    wrongTranslations.push(...dbWrong.map((m) => m.translation));
  }

  const direction = randomDirection(langPair);
  const isForward = direction === langPair;

  if (isForward) {
    const options = shuffle([correct.translation, ...wrongTranslations]);
    return {
      meaningId: -correct.id, // Отрицательный id = кастомное слово
      word: correct.wordText,
      correctTranslation: correct.translation,
      options,
      direction,
    };
  } else {
    // Обратное направление: показываем перевод, варианты — английские слова
    const otherWords = shuffle(
      allCustom.filter((w) => w.id !== correct.id && w.wordText !== correct.wordText),
    );
    const wrongWords: string[] = otherWords.slice(0, 3).map((w) => w.wordText);

    if (wrongWords.length < 3) {
      const dbWrong = await db.query.wordMeanings.findMany({
        where: ne(wordMeanings.translation, correct.translation),
        with: { word: true },
        limit: 3 - wrongWords.length,
        orderBy: sql`RANDOM()`,
      });
      wrongWords.push(...dbWrong.map((m) => m.word.text));
    }

    const options = shuffle([correct.wordText, ...wrongWords]);
    return {
      meaningId: -correct.id,
      word: correct.translation,
      correctTranslation: correct.wordText,
      options,
      direction,
    };
  }
}

export async function recordInfiniteAnswer(
  userId: number,
  meaningId: number,
  selectedMeaningId: number | null,
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

  // Начисляем XP
  let xpEarned = 0;
  if (isCorrect) {
    xpEarned = XP_PER_CORRECT;
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) throw new Error('Пользователь не найден');

    const newXp = user.xp + xpEarned;
    const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;

    await db
      .update(users)
      .set({
        xp: newXp,
        level: newLevel,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    return {
      isCorrect,
      correctTranslation,
      xpEarned,
      totalXp: newXp,
      level: newLevel,
      levelUp: newLevel > user.level ? newLevel : undefined,
    };
  }

  return {
    isCorrect,
    correctTranslation,
    xpEarned: 0,
    totalXp: undefined,
    level: undefined,
    levelUp: undefined,
  };
}
