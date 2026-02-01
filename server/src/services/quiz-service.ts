import { eq, ne, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wordMeanings, quizSessions, quizAnswers, users } from '../db/schema.js';

const QUESTIONS_PER_SESSION = 10;
const XP_PER_CORRECT = 10;
const XP_STREAK_BONUS = 5;

type Question = {
  meaningId: number;
  word: string;
  correctTranslation: string;
  options: string[];
};

export async function createSession(userId: number) {
  const [session] = await db
    .insert(quizSessions)
    .values({ userId, type: 'solo' })
    .returning();
  return session!;
}

export async function generateQuestion(excludeMeaningIds: number[] = []): Promise<Question | null> {
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

  // 3 неправильных варианта той же сложности, не совпадающие по переводу
  const wrongOptions = await db.query.wordMeanings.findMany({
    where: and(
      ne(wordMeanings.id, correct.id),
      eq(wordMeanings.difficulty, correct.difficulty),
      ne(wordMeanings.translation, correct.translation),
    ),
    limit: 3,
    orderBy: sql`RANDOM()`,
  });

  // Если мало вариантов той же сложности, берём любые
  if (wrongOptions.length < 3) {
    const moreOptions = await db.query.wordMeanings.findMany({
      where: and(
        ne(wordMeanings.id, correct.id),
        ne(wordMeanings.translation, correct.translation),
        wrongOptions.length > 0
          ? sql`${wordMeanings.id} NOT IN (${sql.join(wrongOptions.map(o => sql`${o.id}`), sql`, `)})`
          : undefined,
      ),
      limit: 3 - wrongOptions.length,
      orderBy: sql`RANDOM()`,
    });
    wrongOptions.push(...moreOptions);
  }

  const options = [correct.translation, ...wrongOptions.map(o => o.translation)];
  // Перемешиваем варианты
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }

  return {
    meaningId: correct.id,
    word: correct.word.text,
    correctTranslation: correct.translation,
    options,
  };
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
    isCorrect = selected?.translation === correctMeaning.translation;
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
