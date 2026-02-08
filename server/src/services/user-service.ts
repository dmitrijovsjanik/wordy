import { eq, and, gte, asc, isNotNull, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, quizSessions, duels, streakActivityDays, userLeagueProgress, userSeasonStats, userWordProgress } from '../db/schema.js';
import { MAX_STREAK_FREEZES, FREEZE_PACKS } from '../config/gems-config.js';
import { LEAGUE_TIERS } from '../config/league-config.js';

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
      premiumUntil: true,
      premiumPlan: true,
      autoRenew: true,
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
    columns: { maxStreakDays: true, bestAnswerStreak: true },
  });

  // Вычисляем максимальную лигу из текущего тира и истории сезонов
  const currentProgress = await db.query.userLeagueProgress.findFirst({
    where: eq(userLeagueProgress.userId, userId),
    columns: { tier: true },
  });

  const seasonHistory = await db.query.userSeasonStats.findMany({
    where: eq(userSeasonStats.userId, userId),
    columns: { tierAtEnd: true },
  });

  let maxLeagueTier: string | null = currentProgress?.tier ?? null;
  const currentIdx = maxLeagueTier ? LEAGUE_TIERS.indexOf(maxLeagueTier as typeof LEAGUE_TIERS[number]) : -1;
  let maxIdx = currentIdx;

  for (const season of seasonHistory) {
    if (season.tierAtEnd) {
      const idx = LEAGUE_TIERS.indexOf(season.tierAtEnd as typeof LEAGUE_TIERS[number]);
      if (idx > maxIdx) {
        maxIdx = idx;
        maxLeagueTier = season.tierAtEnd;
      }
    }
  }

  // Кол-во выученных слов (masteredAt IS NOT NULL)
  const [masteredRow] = await db
    .select({ value: count() })
    .from(userWordProgress)
    .where(and(eq(userWordProgress.userId, userId), isNotNull(userWordProgress.masteredAt)));

  return {
    totalGames,
    totalCorrect,
    totalQuestions,
    correctPercent,
    bestAnswerStreak: user?.bestAnswerStreak ?? 0,
    maxStreakDays: user?.maxStreakDays ?? 0,
    maxLeagueTier,
    wordsLearned: masteredRow.value,
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
    columns: {
      lastLoginDate: true,
      streakDays: true,
      dailyCorrectCount: true,
      dailyCorrectDate: true,
      dailyStreakMilestonesDone: true,
      dailyCorrectMilestonesDone: true,
    },
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

  // Дневные счётчики — проверяем что дата сегодня
  let dailyCorrectCount = 0;
  let streakMilestonesDone: number[] = [];
  let correctMilestonesDone: number[] = [];

  if (user.dailyCorrectDate) {
    const lastDate = new Date(
      Date.UTC(user.dailyCorrectDate.getUTCFullYear(), user.dailyCorrectDate.getUTCMonth(), user.dailyCorrectDate.getUTCDate())
    );
    if (lastDate.getTime() === todayStart.getTime()) {
      dailyCorrectCount = user.dailyCorrectCount;
      streakMilestonesDone = user.dailyStreakMilestonesDone.split(',').filter(Boolean).map(Number);
      correctMilestonesDone = user.dailyCorrectMilestonesDone.split(',').filter(Boolean).map(Number);
    }
  }

  return {
    dailyPlayDone,
    duelWinDone,
    streakDays: user.streakDays,
    dailyCorrectCount,
    streakMilestonesDone,
    correctMilestonesDone,
  };
}

export async function purchaseStreakFreeze(userId: number, days: number) {
  const pack = FREEZE_PACKS.find((p) => p.days === days);
  if (!pack) throw new Error('INVALID_PACK');

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { gems: true, streakFreezes: true },
  });

  if (!user) throw new Error('Пользователь не найден');

  if (user.gems < pack.gems) {
    throw new Error('INSUFFICIENT_GEMS');
  }

  if (user.streakFreezes >= MAX_STREAK_FREEZES) {
    throw new Error('MAX_FREEZES_REACHED');
  }

  const [updated] = await db
    .update(users)
    .set({
      gems: user.gems - pack.gems,
      streakFreezes: user.streakFreezes + pack.days,
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
