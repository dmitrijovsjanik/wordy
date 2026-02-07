import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  leagueSeasons,
  userLeagueProgress,
  userSeasonStats,
  leagueNotifications,
  dailyLeagueSnapshots,
} from '../db/schema.js';
import {
  LP_CORRECT_ANSWER,
  LP_QUIZ_COMPLETE,
  LP_DUEL_WIN,
  LP_STREAK_DAYS_MULTIPLIER,
  TIER_THRESHOLDS,
  SEASON_REWARDS,
  DEMOTION_LIMIT,
  SEASON_SCHEDULE,
  isProtectedTier,
  getNextTier,
  getPrevTier,
  getSeasonZone,
  getLpModifier,
  applyModifier,
  type LeagueTier,
} from '../config/league-config.js';
import { addGems } from './progression-service.js';

// ─── Season Management ──────────────────────────────────────────────────────

export async function getCurrentSeason() {
  const season = await db.query.leagueSeasons.findFirst({
    where: eq(leagueSeasons.isActive, true),
  });
  return season ?? null;
}

export async function getOrCreateCurrentSeason() {
  let season = await getCurrentSeason();

  if (!season) {
    console.log('[League] No active season found, creating new one...');
    season = await createSeason();
    console.log(`[League] Season ${season.id} created`);
  }

  return season;
}

export async function createSeason() {
  const now = new Date();
  const startOfWeek = getStartOfWeek(now);
  const weekNumber = getISOWeekNumber(now);
  const year = now.getFullYear();

  await db
    .update(leagueSeasons)
    .set({ isActive: false, endedAt: now })
    .where(eq(leagueSeasons.isActive, true));

  const [season] = await db
    .insert(leagueSeasons)
    .values({
      weekNumber,
      year,
      startedAt: startOfWeek,
      isActive: true,
    })
    .returning();

  return season!;
}

// ─── User League Progress ───────────────────────────────────────────────────

export async function getUserLeagueProgress(userId: number) {
  let progress = await db.query.userLeagueProgress.findFirst({
    where: eq(userLeagueProgress.userId, userId),
  });

  if (!progress) {
    const [newProgress] = await db
      .insert(userLeagueProgress)
      .values({ userId, tier: 'bronze', division: 1 })
      .returning();
    progress = newProgress!;
  }

  return progress;
}

export async function ensureUserSeasonStats(userId: number, seasonId: number) {
  const existing = await db.query.userSeasonStats.findFirst({
    where: and(
      eq(userSeasonStats.userId, userId),
      eq(userSeasonStats.seasonId, seasonId),
    ),
  });

  if (existing) return existing;

  const progress = await getUserLeagueProgress(userId);

  const [stats] = await db
    .insert(userSeasonStats)
    .values({
      userId,
      seasonId,
      tierAtStart: progress.tier,
      divisionAtStart: progress.division,
    })
    .returning();

  return stats!;
}

// ─── LP Operations ──────────────────────────────────────────────────────────

async function addLeaguePoints(userId: number, points: number, field: 'correctAnswers' | 'quizzesCompleted' | 'duelsWon' | 'streakBonus'): Promise<number> {
  const season = await getOrCreateCurrentSeason();

  await ensureUserSeasonStats(userId, season.id);

  const updateData: Record<string, unknown> = {
    leaguePoints: sql`${userSeasonStats.leaguePoints} + ${points}`,
    updatedAt: new Date(),
  };

  if (field === 'correctAnswers') {
    updateData.correctAnswers = sql`${userSeasonStats.correctAnswers} + 1`;
  } else if (field === 'quizzesCompleted') {
    updateData.quizzesCompleted = sql`${userSeasonStats.quizzesCompleted} + 1`;
  } else if (field === 'duelsWon') {
    updateData.duelsWon = sql`${userSeasonStats.duelsWon} + 1`;
  } else if (field === 'streakBonus') {
    updateData.streakBonus = sql`${userSeasonStats.streakBonus} + ${points}`;
  }

  await db
    .update(userSeasonStats)
    .set(updateData)
    .where(
      and(
        eq(userSeasonStats.userId, userId),
        eq(userSeasonStats.seasonId, season.id),
      ),
    );

  const stats = await db.query.userSeasonStats.findFirst({
    where: and(
      eq(userSeasonStats.userId, userId),
      eq(userSeasonStats.seasonId, season.id),
    ),
  });

  if (stats) {
    await checkAndCreateNotifications(userId, season.id, stats.leaguePoints);
  }

  return stats?.leaguePoints ?? 0;
}

export async function addLpForCorrectAnswer(userId: number, streak: number = 0): Promise<{ lpEarned: number; lpModifier: number; totalLp: number }> {
  const lpModifier = getLpModifier(streak);
  const lpEarned = applyModifier(LP_CORRECT_ANSWER, lpModifier);
  const totalLp = await addLeaguePoints(userId, lpEarned, 'correctAnswers');
  return { lpEarned, lpModifier, totalLp };
}

export async function addLpForQuizComplete(userId: number) {
  await addLeaguePoints(userId, LP_QUIZ_COMPLETE, 'quizzesCompleted');
}

export async function addLpForDuelWin(userId: number) {
  await addLeaguePoints(userId, LP_DUEL_WIN, 'duelsWon');
}

export async function addLpForStreak(userId: number, streakDays: number) {
  const points = LP_STREAK_DAYS_MULTIPLIER * streakDays;
  await addLeaguePoints(userId, points, 'streakBonus');
}

// ─── Leaderboard ────────────────────────────────────────────────────────────

export async function getLeaderboard(
  seasonId: number,
  tier: LeagueTier,
  limit = 50,
) {
  // Получаем пользователей в том же тире
  const usersInTier = await db
    .select({ userId: userLeagueProgress.userId })
    .from(userLeagueProgress)
    .where(eq(userLeagueProgress.tier, tier));

  const userIds = usersInTier.map((u) => u.userId);
  if (userIds.length === 0) return [];

  const stats = await db
    .select({
      userId: userSeasonStats.userId,
      leaguePoints: userSeasonStats.leaguePoints,
      firstName: users.firstName,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(userSeasonStats)
    .innerJoin(users, eq(userSeasonStats.userId, users.id))
    .where(
      and(
        eq(userSeasonStats.seasonId, seasonId),
        inArray(userSeasonStats.userId, userIds),
      ),
    )
    .orderBy(desc(userSeasonStats.leaguePoints))
    .limit(limit);

  const resultUserIds = stats.map((s) => s.userId);
  const [todaySnapshots, yesterdaySnapshots] = await Promise.all([
    getTodayStartSnapshotsForUsers(seasonId, resultUserIds),
    getYesterdaySnapshotsForUsers(seasonId, resultUserIds),
  ]);

  return stats.map((s, idx) => {
    const currentPosition = idx + 1;
    const todaySnapshot = todaySnapshots.get(s.userId);
    const yesterdaySnapshot = yesterdaySnapshots.get(s.userId);

    const lpToday = todaySnapshot ? s.leaguePoints - todaySnapshot.leaguePoints : s.leaguePoints;
    const positionChange = yesterdaySnapshot ? yesterdaySnapshot.position - currentPosition : 0;

    return {
      userId: s.userId,
      firstName: s.firstName,
      username: s.username,
      avatarUrl: s.avatarUrl,
      leaguePoints: s.leaguePoints,
      position: currentPosition,
      lpToday,
      positionChange,
    };
  });
}

export async function getUserPosition(userId: number, seasonId: number) {
  const progress = await getUserLeagueProgress(userId);

  const userStats = await db.query.userSeasonStats.findFirst({
    where: and(
      eq(userSeasonStats.userId, userId),
      eq(userSeasonStats.seasonId, seasonId),
    ),
  });

  if (!userStats) return { position: 0, total: 0 };

  const usersInTier = await db
    .select({ id: userLeagueProgress.userId })
    .from(userLeagueProgress)
    .where(eq(userLeagueProgress.tier, progress.tier));

  const userIds = usersInTier.map((u) => u.id);

  const [countResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(userSeasonStats)
    .where(
      and(
        eq(userSeasonStats.seasonId, seasonId),
        inArray(userSeasonStats.userId, userIds),
        sql`${userSeasonStats.leaguePoints} > ${userStats.leaguePoints}`,
      ),
    );

  const position = (countResult?.count ?? 0) + 1;

  return { position, total: userIds.length };
}

export async function getUserSeasonStats(userId: number, seasonId: number) {
  return db.query.userSeasonStats.findFirst({
    where: and(
      eq(userSeasonStats.userId, userId),
      eq(userSeasonStats.seasonId, seasonId),
    ),
  });
}

export async function getUserSeasonHistory(userId: number, limit = 10) {
  return db.query.userSeasonStats.findMany({
    where: eq(userSeasonStats.userId, userId),
    orderBy: desc(userSeasonStats.createdAt),
    limit,
    with: { season: true },
  });
}

// ─── Season Finalization ────────────────────────────────────────────────────

export async function finalizeSeason(seasonId: number) {
  const allStats = await db
    .select({
      statsId: userSeasonStats.id,
      userId: userSeasonStats.userId,
      leaguePoints: userSeasonStats.leaguePoints,
      tier: userLeagueProgress.tier,
    })
    .from(userSeasonStats)
    .innerJoin(userLeagueProgress, eq(userSeasonStats.userId, userLeagueProgress.userId))
    .where(eq(userSeasonStats.seasonId, seasonId))
    .orderBy(
      asc(userLeagueProgress.tier),
      desc(userSeasonStats.leaguePoints),
    );

  // Группируем по tier
  const groups = new Map<string, typeof allStats>();
  for (const stat of allStats) {
    const key = stat.tier;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(stat);
  }

  for (const [, groupStats] of groups) {
    await processGroup(groupStats, seasonId);
  }

  await db
    .update(leagueSeasons)
    .set({ isActive: false, endedAt: new Date() })
    .where(eq(leagueSeasons.id, seasonId));
}

async function processGroup(
  stats: Array<{
    statsId: number;
    userId: number;
    leaguePoints: number;
    tier: string;
  }>,
  seasonId: number,
) {
  const tier = stats[0]?.tier as LeagueTier;
  const isProtected = isProtectedTier(tier);
  const thresholds = TIER_THRESHOLDS[tier];
  const rewards = SEASON_REWARDS[tier];

  const sorted = [...stats].sort((a, b) => b.leaguePoints - a.leaguePoints);

  for (const stat of sorted) {
    const zone = getSeasonZone(tier, stat.leaguePoints);
    let newTier: LeagueTier = tier;
    let tierChange = 0;
    let gemsReward = 0;

    if (zone === 'promotion') {
      const nextTier = getNextTier(tier);
      if (nextTier) {
        newTier = nextTier;
        tierChange = 1;
      }
      gemsReward = rewards.promotion;
    } else if (zone === 'maintain') {
      gemsReward = rewards.maintain;
    } else if (zone === 'demotion' && !isProtected) {
      // Только нижние DEMOTION_LIMIT человек в зоне понижения реально понижаются
      const demotionGroup = sorted.filter(
        (s) => s.leaguePoints < thresholds.demotion,
      );
      const posInGroup = demotionGroup.indexOf(stat);
      const totalInGroup = demotionGroup.length;

      if (totalInGroup - posInGroup <= DEMOTION_LIMIT) {
        const prevTier = getPrevTier(tier);
        if (prevTier) {
          newTier = prevTier;
          tierChange = -1;
        }
      }
      // Понижённые не получают гемов
    }

    // Обновляем userLeagueProgress
    await db
      .update(userLeagueProgress)
      .set({
        tier: newTier,
        division: 1,
        updatedAt: new Date(),
      })
      .where(eq(userLeagueProgress.userId, stat.userId));

    // Обновляем userSeasonStats
    await db
      .update(userSeasonStats)
      .set({
        tierAtEnd: newTier,
        divisionAtEnd: 1,
        divisionChange: tierChange,
        updatedAt: new Date(),
      })
      .where(eq(userSeasonStats.id, stat.statsId));

    // Начисляем гемы за сезон
    if (gemsReward > 0) {
      await addGems(stat.userId, gemsReward);
    }

    // Уведомление о результате
    let notificationType: 'promoted' | 'demoted' | 'maintained';
    if (tierChange > 0) {
      notificationType = 'promoted';
    } else if (tierChange < 0) {
      notificationType = 'demoted';
    } else {
      notificationType = 'maintained';
    }

    await db.insert(leagueNotifications).values({
      userId: stat.userId,
      seasonId,
      type: notificationType,
      payload: JSON.stringify({ tierChange, newTier, gemsReward }),
    });
  }
}

// ─── Notifications ──────────────────────────────────────────────────────────

async function checkAndCreateNotifications(userId: number, seasonId: number, newLp: number) {
  const existingNotifications = await db.query.leagueNotifications.findMany({
    where: and(
      eq(leagueNotifications.userId, userId),
      eq(leagueNotifications.seasonId, seasonId),
    ),
  });

  const existingTypes = new Set(existingNotifications.map((n) => n.type));

  const progress = await getUserLeagueProgress(userId);
  const thresholds = TIER_THRESHOLDS[progress.tier as LeagueTier];

  // Safe zone (для не-protected тиров)
  if (thresholds.demotion > 0 && newLp >= thresholds.demotion && !existingTypes.has('safe_zone_reached')) {
    await db.insert(leagueNotifications).values({
      userId,
      seasonId,
      type: 'safe_zone_reached',
    });
  }

  // Достиг порога повышения
  if (newLp >= thresholds.promotion && !existingTypes.has('competition_entered')) {
    await db.insert(leagueNotifications).values({
      userId,
      seasonId,
      type: 'competition_entered',
    });
  }
}

export async function getUnreadNotifications(userId: number) {
  return db.query.leagueNotifications.findMany({
    where: and(
      eq(leagueNotifications.userId, userId),
      eq(leagueNotifications.isRead, false),
    ),
    orderBy: desc(leagueNotifications.createdAt),
  });
}

export async function markNotificationsRead(userId: number, ids: number[]) {
  if (ids.length === 0) return;

  await db
    .update(leagueNotifications)
    .set({ isRead: true })
    .where(
      and(
        eq(leagueNotifications.userId, userId),
        inArray(leagueNotifications.id, ids),
      ),
    );
}

export async function sendSeasonEndingReminders(seasonId: number) {
  const activeUsers = await db
    .select({ userId: userSeasonStats.userId })
    .from(userSeasonStats)
    .where(eq(userSeasonStats.seasonId, seasonId));

  for (const { userId } of activeUsers) {
    const existing = await db.query.leagueNotifications.findFirst({
      where: and(
        eq(leagueNotifications.userId, userId),
        eq(leagueNotifications.seasonId, seasonId),
        eq(leagueNotifications.type, 'season_ending'),
      ),
    });

    if (!existing) {
      await db.insert(leagueNotifications).values({
        userId,
        seasonId,
        type: 'season_ending',
      });
    }
  }
}

// ─── Daily Snapshots ─────────────────────────────────────────────────────────

function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getYesterdayStart(): Date {
  const d = getStartOfDay();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

export async function saveDailySnapshot(
  userId: number,
  seasonId: number,
  leaguePoints: number,
  position: number,
) {
  const today = getStartOfDay();

  const existing = await db.query.dailyLeagueSnapshots.findFirst({
    where: and(
      eq(dailyLeagueSnapshots.userId, userId),
      eq(dailyLeagueSnapshots.seasonId, seasonId),
      eq(dailyLeagueSnapshots.date, today),
    ),
  });

  if (!existing) {
    await db.insert(dailyLeagueSnapshots).values({
      userId,
      seasonId,
      date: today,
      leaguePoints,
      position,
    });
  }
}

export async function getTodayStartSnapshot(userId: number, seasonId: number) {
  const today = getStartOfDay();

  return db.query.dailyLeagueSnapshots.findFirst({
    where: and(
      eq(dailyLeagueSnapshots.userId, userId),
      eq(dailyLeagueSnapshots.seasonId, seasonId),
      eq(dailyLeagueSnapshots.date, today),
    ),
  });
}

export async function getYesterdaySnapshot(userId: number, seasonId: number) {
  const yesterday = getYesterdayStart();

  return db.query.dailyLeagueSnapshots.findFirst({
    where: and(
      eq(dailyLeagueSnapshots.userId, userId),
      eq(dailyLeagueSnapshots.seasonId, seasonId),
      eq(dailyLeagueSnapshots.date, yesterday),
    ),
  });
}

async function getYesterdaySnapshotsForUsers(
  seasonId: number,
  userIds: number[],
): Promise<Map<number, { leaguePoints: number; position: number }>> {
  if (userIds.length === 0) return new Map();

  const yesterday = getYesterdayStart();

  const snapshots = await db
    .select()
    .from(dailyLeagueSnapshots)
    .where(
      and(
        eq(dailyLeagueSnapshots.seasonId, seasonId),
        eq(dailyLeagueSnapshots.date, yesterday),
        inArray(dailyLeagueSnapshots.userId, userIds),
      ),
    );

  const map = new Map<number, { leaguePoints: number; position: number }>();
  for (const s of snapshots) {
    map.set(s.userId, { leaguePoints: s.leaguePoints, position: s.position });
  }
  return map;
}

async function getTodayStartSnapshotsForUsers(
  seasonId: number,
  userIds: number[],
): Promise<Map<number, { leaguePoints: number; position: number }>> {
  if (userIds.length === 0) return new Map();

  const today = getStartOfDay();

  const snapshots = await db
    .select()
    .from(dailyLeagueSnapshots)
    .where(
      and(
        eq(dailyLeagueSnapshots.seasonId, seasonId),
        eq(dailyLeagueSnapshots.date, today),
        inArray(dailyLeagueSnapshots.userId, userIds),
      ),
    );

  const map = new Map<number, { leaguePoints: number; position: number }>();
  for (const s of snapshots) {
    map.set(s.userId, { leaguePoints: s.leaguePoints, position: s.position });
  }
  return map;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();

  let daysBack = day === 0 ? 0 : day;

  if (day === 0 && d.getUTCHours() < SEASON_SCHEDULE.cronHourUTC) {
    daysBack = 7;
  }

  d.setUTCDate(d.getUTCDate() - daysBack);
  d.setUTCHours(SEASON_SCHEDULE.cronHourUTC, SEASON_SCHEDULE.cronMinute, 0, 0);
  return d;
}

function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
