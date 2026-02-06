import { eq, and, gte, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, quizSessions, duels, streakActivityDays } from '../db/schema.js';
import { STREAK_FREEZE_COST, MAX_STREAK_FREEZES } from '../config/gems-config.js';

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
      streakFreezes: true,
      gems: true,
      nativeLanguage: true,
      learningLanguage: true,
      repeatMastered: true,
      lastActivityAt: true,
      createdAt: true,
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

export async function updateSettings(userId: number, settings: { repeatMastered?: boolean }) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (settings.repeatMastered !== undefined) {
    updates.repeatMastered = settings.repeatMastered;
  }

  await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId));

  return settings;
}

export async function getDailyRewards(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { lastLoginDate: true, streakDays: true },
  });

  if (!user) throw new Error('Пользователь не найден');

  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  // Ежедневная игра — выполнено, если lastLoginDate сегодня
  let dailyPlayDone = false;
  if (user.lastLoginDate) {
    const lastDate = new Date(
      Date.UTC(user.lastLoginDate.getUTCFullYear(), user.lastLoginDate.getUTCMonth(), user.lastLoginDate.getUTCDate())
    );
    dailyPlayDone = lastDate.getTime() === todayStart.getTime();
  }

  // Победа в дуэли сегодня
  const todayDuelWins = await db.query.duels.findMany({
    where: and(
      eq(duels.winnerId, userId),
      eq(duels.status, 'finished'),
      gte(duels.updatedAt, todayStart),
    ),
    columns: { id: true },
    limit: 1,
  });
  const duelWinDone = todayDuelWins.length > 0;

  return { dailyPlayDone, duelWinDone, streakDays: user.streakDays };
}

export async function purchaseStreakFreeze(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { gems: true, streakFreezes: true },
  });

  if (!user) throw new Error('Пользователь не найден');

  if (user.gems < STREAK_FREEZE_COST) {
    throw new Error('INSUFFICIENT_GEMS');
  }

  if (user.streakFreezes >= MAX_STREAK_FREEZES) {
    throw new Error('MAX_FREEZES_REACHED');
  }

  const [updated] = await db
    .update(users)
    .set({
      gems: user.gems - STREAK_FREEZE_COST,
      streakFreezes: user.streakFreezes + 1,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({ gems: users.gems, streakFreezes: users.streakFreezes });

  return { gems: updated.gems, streakFreezes: updated.streakFreezes };
}

export async function getStreakCalendar(userId: number, months: number) {
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));

  // Запрашиваем трекинговые дни из БД
  const trackedDays = await db.query.streakActivityDays.findMany({
    where: and(
      eq(streakActivityDays.userId, userId),
      gte(streakActivityDays.date, startDate),
    ),
    columns: { date: true, type: true },
    orderBy: [asc(streakActivityDays.date)],
  });

  // Получаем данные пользователя для вывода прошлых дней из текущего стрика
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { streakDays: true, lastLoginDate: true, createdAt: true },
  });

  const result = trackedDays.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    type: d.type,
  }));

  // Для дат ДО начала трекинга — выводим из текущего стрика
  if (user && user.streakDays > 0 && user.lastLoginDate) {
    const trackedDateSet = new Set(result.map((d) => d.date));

    for (let i = 0; i < user.streakDays; i++) {
      const d = new Date(user.lastLoginDate);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().slice(0, 10);

      if (!trackedDateSet.has(dateStr) && d >= startDate && d >= user.createdAt) {
        result.push({ date: dateStr, type: 'play' });
        trackedDateSet.add(dateStr);
      }
    }
  }

  result.sort((a, b) => a.date.localeCompare(b.date));

  return {
    streakDays: user?.streakDays ?? 0,
    activityDays: result,
  };
}
