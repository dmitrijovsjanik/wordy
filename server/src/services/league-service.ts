import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  leagueSeasons,
  userLeagueProgress,
  userSeasonStats,
  leagueNotifications,
  dailyLeagueSnapshots,
  type leagueTierEnum,
} from '../db/schema.js';
import {
  LP_CORRECT_ANSWER,
  LP_QUIZ_COMPLETE,
  LP_DUEL_WIN,
  LP_STREAK_DAYS_MULTIPLIER,
  LP_THRESHOLDS,
  TOP_POSITIONS,
  DEMOTION_LIMITS,
  SEASON_SCHEDULE,
  isProtectedTier,
  calculateDivisionChange,
  getLpModifier,
  applyModifier,
  type LeagueTier,
} from '../config/league-config.js';

// ─── Season Management ──────────────────────────────────────────────────────

export async function getCurrentSeason() {
  const season = await db.query.leagueSeasons.findFirst({
    where: eq(leagueSeasons.isActive, true),
  });
  return season ?? null;
}

/**
 * Получает текущий сезон или создаёт новый, если его нет.
 * Вызывается при старте сервера и в API.
 */
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

  // Деактивируем предыдущий сезон
  await db
    .update(leagueSeasons)
    .set({ isActive: false, endedAt: now })
    .where(eq(leagueSeasons.isActive, true));

  // Создаём новый
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
    // Создаём запись для нового пользователя
    const [newProgress] = await db
      .insert(userLeagueProgress)
      .values({ userId, tier: 'bronze', division: 3 })
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

  // Проверяем достижения и создаём уведомления
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
  division: number,
  limit = 50,
) {
  // Получаем пользователей в той же лиге/дивизионе
  const usersInDivision = await db
    .select({ userId: userLeagueProgress.userId })
    .from(userLeagueProgress)
    .where(
      and(
        eq(userLeagueProgress.tier, tier),
        eq(userLeagueProgress.division, division),
      ),
    );

  const userIds = usersInDivision.map((u) => u.userId);
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

  // Получаем снепшоты за начало сегодня и за вчера
  const resultUserIds = stats.map((s) => s.userId);
  const [todaySnapshots, yesterdaySnapshots] = await Promise.all([
    getTodayStartSnapshotsForDivision(seasonId, resultUserIds),
    getYesterdaySnapshotsForDivision(seasonId, resultUserIds),
  ]);

  return stats.map((s, idx) => {
    const currentPosition = idx + 1;
    const todaySnapshot = todaySnapshots.get(s.userId);
    const yesterdaySnapshot = yesterdaySnapshots.get(s.userId);

    // LP за сегодня = текущие LP - LP на начало дня
    const lpToday = todaySnapshot ? s.leaguePoints - todaySnapshot.leaguePoints : s.leaguePoints;

    // Изменение позиции = вчерашняя позиция - текущая (положительное = рост)
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

  // Подсчитываем позицию среди пользователей той же лиги/дивизиона
  const userStats = await db.query.userSeasonStats.findFirst({
    where: and(
      eq(userSeasonStats.userId, userId),
      eq(userSeasonStats.seasonId, seasonId),
    ),
  });

  if (!userStats) return { position: 0, total: 0 };

  const usersInDivision = await db
    .select({ id: userLeagueProgress.userId })
    .from(userLeagueProgress)
    .where(
      and(
        eq(userLeagueProgress.tier, progress.tier),
        eq(userLeagueProgress.division, progress.division),
      ),
    );

  const userIds = usersInDivision.map((u) => u.id);

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
  // Получаем все статистики за сезон, сгруппированные по tier+division
  const allStats = await db
    .select({
      statsId: userSeasonStats.id,
      userId: userSeasonStats.userId,
      leaguePoints: userSeasonStats.leaguePoints,
      tier: userLeagueProgress.tier,
      division: userLeagueProgress.division,
    })
    .from(userSeasonStats)
    .innerJoin(userLeagueProgress, eq(userSeasonStats.userId, userLeagueProgress.userId))
    .where(eq(userSeasonStats.seasonId, seasonId))
    .orderBy(
      asc(userLeagueProgress.tier),
      asc(userLeagueProgress.division),
      desc(userSeasonStats.leaguePoints),
    );

  // Группируем по tier+division
  const groups = new Map<string, typeof allStats>();
  for (const stat of allStats) {
    const key = `${stat.tier}:${stat.division}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(stat);
  }

  // Обрабатываем каждую группу
  for (const [, groupStats] of groups) {
    await processGroup(groupStats, seasonId);
  }

  // Закрываем сезон
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
    tier: (typeof leagueTierEnum.enumValues)[number];
    division: number;
  }>,
  seasonId: number,
) {
  const tier = stats[0]?.tier as LeagueTier;
  const division = stats[0]?.division ?? 3;
  const isProtected = isProtectedTier(tier);

  // Сортируем по LP (убывание)
  const sorted = [...stats].sort((a, b) => b.leaguePoints - a.leaguePoints);

  // Считаем позиции в каждой группе LP
  const promotion3 = sorted.filter((s) => s.leaguePoints >= LP_THRESHOLDS.PROMOTION_3.min);
  const promotion2 = sorted.filter(
    (s) => s.leaguePoints >= LP_THRESHOLDS.PROMOTION_2.min && s.leaguePoints <= LP_THRESHOLDS.PROMOTION_2.max,
  );
  const promotion1 = sorted.filter(
    (s) => s.leaguePoints >= LP_THRESHOLDS.PROMOTION_1.min && s.leaguePoints <= LP_THRESHOLDS.PROMOTION_1.max,
  );
  const maintain = sorted.filter(
    (s) => s.leaguePoints >= LP_THRESHOLDS.MAINTAIN.min && s.leaguePoints <= LP_THRESHOLDS.MAINTAIN.max,
  );
  const demotion1 = sorted.filter(
    (s) => s.leaguePoints >= LP_THRESHOLDS.DEMOTION_1.min && s.leaguePoints <= LP_THRESHOLDS.DEMOTION_1.max,
  );
  const demotion2 = sorted.filter((s) => s.leaguePoints <= LP_THRESHOLDS.DEMOTION_2.max);

  // Обрабатываем каждую группу
  for (const stat of sorted) {
    let divisionChange = 0;

    if (promotion3.includes(stat)) {
      // Топ 5 в 1000+ получают +3, остальные +2
      const posInGroup = promotion3.indexOf(stat);
      divisionChange = posInGroup < TOP_POSITIONS.PROMOTION_3_TOP ? 3 : 2;
    } else if (promotion2.includes(stat)) {
      // Топ 10 в 700-999 получают +2, остальные +1
      const posInGroup = promotion2.indexOf(stat);
      divisionChange = posInGroup < TOP_POSITIONS.PROMOTION_2_TOP ? 2 : 1;
    } else if (promotion1.includes(stat)) {
      divisionChange = 1;
    } else if (maintain.includes(stat)) {
      divisionChange = 0;
    } else if (demotion1.includes(stat)) {
      // Только нижние 10 получают -1 (если не защищены)
      const posInGroup = demotion1.indexOf(stat);
      const totalInGroup = demotion1.length;
      if (!isProtected && totalInGroup - posInGroup <= DEMOTION_LIMITS.DEMOTION_1_LIMIT) {
        divisionChange = -1;
      }
    } else if (demotion2.includes(stat)) {
      // Только нижние 5 получают -2 (если не защищены)
      const posInGroup = demotion2.indexOf(stat);
      const totalInGroup = demotion2.length;
      if (!isProtected && totalInGroup - posInGroup <= DEMOTION_LIMITS.DEMOTION_2_LIMIT) {
        divisionChange = -2;
      } else if (!isProtected && totalInGroup - posInGroup <= DEMOTION_LIMITS.DEMOTION_2_LIMIT + DEMOTION_LIMITS.DEMOTION_1_LIMIT) {
        divisionChange = -1;
      }
    }

    // Применяем изменение
    const { newTier, newDivision } = calculateDivisionChange(tier, division, divisionChange);

    // Обновляем userLeagueProgress
    await db
      .update(userLeagueProgress)
      .set({
        tier: newTier,
        division: newDivision,
        updatedAt: new Date(),
      })
      .where(eq(userLeagueProgress.userId, stat.userId));

    // Обновляем userSeasonStats с результатами
    await db
      .update(userSeasonStats)
      .set({
        tierAtEnd: newTier,
        divisionAtEnd: newDivision,
        divisionChange,
        updatedAt: new Date(),
      })
      .where(eq(userSeasonStats.id, stat.statsId));

    // Создаём уведомление о результате
    let notificationType: 'promoted' | 'demoted' | 'maintained';
    if (divisionChange > 0) {
      notificationType = 'promoted';
    } else if (divisionChange < 0) {
      notificationType = 'demoted';
    } else {
      notificationType = 'maintained';
    }

    await db.insert(leagueNotifications).values({
      userId: stat.userId,
      seasonId,
      type: notificationType,
      payload: JSON.stringify({ divisionChange, newTier, newDivision }),
    });
  }
}

// ─── Notifications ──────────────────────────────────────────────────────────

async function checkAndCreateNotifications(userId: number, seasonId: number, newLp: number) {
  // Проверяем, какие уведомления уже были
  const existingNotifications = await db.query.leagueNotifications.findMany({
    where: and(
      eq(leagueNotifications.userId, userId),
      eq(leagueNotifications.seasonId, seasonId),
    ),
  });

  const existingTypes = new Set(existingNotifications.map((n) => n.type));

  // Safe zone (200 LP)
  if (newLp >= LP_THRESHOLDS.MAINTAIN.min && !existingTypes.has('safe_zone_reached')) {
    await db.insert(leagueNotifications).values({
      userId,
      seasonId,
      type: 'safe_zone_reached',
    });
  }

  // Competition entered (400 LP)
  if (newLp >= LP_THRESHOLDS.PROMOTION_1.min && !existingTypes.has('competition_entered')) {
    await db.insert(leagueNotifications).values({
      userId,
      seasonId,
      type: 'competition_entered',
    });
  }

  // Top 5 check (1000+ LP)
  if (newLp >= LP_THRESHOLDS.PROMOTION_3.min) {
    const position = await getUserPosition(userId, seasonId);
    if (position.position <= TOP_POSITIONS.PROMOTION_3_TOP && !existingTypes.has('top5_reached')) {
      await db.insert(leagueNotifications).values({
        userId,
        seasonId,
        type: 'top5_reached',
      });
    }
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
  // Получаем всех активных пользователей сезона
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

/**
 * Получает начало текущего дня (00:00 UTC).
 */
function getStartOfDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Получает начало вчерашнего дня (00:00 UTC).
 */
function getYesterdayStart(): Date {
  const d = getStartOfDay();
  d.setUTCDate(d.getUTCDate() - 1);
  return d;
}

/**
 * Сохраняет ежедневный снепшот LP и позиции для пользователя.
 * Вызывается при первом обращении пользователя за день.
 */
export async function saveDailySnapshot(
  userId: number,
  seasonId: number,
  leaguePoints: number,
  position: number,
) {
  const today = getStartOfDay();

  // Проверяем, есть ли уже снепшот за сегодня
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

/**
 * Получает снепшот за начало сегодняшнего дня (LP на начало дня).
 */
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

/**
 * Получает вчерашний снепшот для расчёта изменения позиции.
 */
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

/**
 * Получает снепшоты за вчера для всех пользователей в дивизионе.
 */
export async function getYesterdaySnapshotsForDivision(
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

/**
 * Получает снепшоты за начало сегодня для всех пользователей в дивизионе.
 */
export async function getTodayStartSnapshotsForDivision(
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

/**
 * Вычисляет время начала текущего сезона.
 * Сезон начинается в воскресенье в 21:00 UTC (00:00 MSK понедельника).
 */
function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = вс, 1 = пн, ...

  // Вычисляем сколько дней назад был последний старт сезона (вс 21:00 UTC)
  // Если сейчас воскресенье до 21:00 — берём предыдущее воскресенье
  // Если сейчас воскресенье после 21:00 — берём текущее воскресенье
  let daysBack = day === 0 ? 0 : day; // дней до последнего воскресенья

  // Если сейчас воскресенье, но ещё до времени старта сезона — берём предыдущую неделю
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
