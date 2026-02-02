import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, quizSessions } from '../db/schema.js';

export async function getProfile(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      firstName: true,
      username: true,
      avatarUrl: true,
      xp: true,
      level: true,
      streakDays: true,
      nativeLanguage: true,
      learningLanguage: true,
      lastActivityAt: true,
    },
  });

  if (!user) throw new Error('Пользователь не найден');
  return user;
}

export async function getStats(userId: number) {
  const sessions = await db.query.quizSessions.findMany({
    where: eq(quizSessions.userId, userId),
    columns: {
      correctCount: true,
      totalCount: true,
    },
  });

  const totalGames = sessions.length;
  const totalCorrect = sessions.reduce((sum, s) => sum + s.correctCount, 0);
  const totalQuestions = sessions.reduce((sum, s) => sum + s.totalCount, 0);
  const correctPercent = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streakDays: true },
  });

  return {
    totalGames,
    totalCorrect,
    totalQuestions,
    correctPercent,
    bestStreak: user?.streakDays ?? 0,
  };
}

export async function updateLanguages(userId: number, nativeLanguage: string, learningLanguage: string) {
  await db
    .update(users)
    .set({ nativeLanguage, learningLanguage, updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { nativeLanguage, learningLanguage };
}
