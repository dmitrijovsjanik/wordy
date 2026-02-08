/**
 * Admin Service
 *
 * SQL-запросы для аналитики, статистики и управления пользователями.
 */

import { eq, sql, desc, count, sum, avg, isNotNull, and, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  quizSessions,
  duels,
  userWordProgress,
  userLeagueProgress,
  streakActivityDays,
  userCustomWordProgress,
} from '../db/schema.js';
import { addGems } from './progression-service.js';

// ─── General Stats ──────────────────────────────────────────────────────────

export async function getGeneralStats() {
  const now = new Date();
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalUsersRow] = await db.select({ value: count() }).from(users);

  const [activeTodayRow] = await db
    .select({ value: count() })
    .from(users)
    .where(gte(users.lastActivityAt, todayStart));

  const [activeWeekRow] = await db
    .select({ value: count() })
    .from(users)
    .where(gte(users.lastActivityAt, weekAgo));

  const [totalQuizzesRow] = await db.select({ value: count() }).from(quizSessions);

  const [totalDuelsRow] = await db
    .select({ value: count() })
    .from(duels)
    .where(eq(duels.status, 'finished'));

  const [avgStreakRow] = await db
    .select({ value: avg(users.streakDays) })
    .from(users)
    .where(gte(users.streakDays, 1));

  return {
    totalUsers: totalUsersRow.value,
    activeToday: activeTodayRow.value,
    activeWeek: activeWeekRow.value,
    totalQuizzes: totalQuizzesRow.value,
    totalDuels: totalDuelsRow.value,
    avgStreak: Number(avgStreakRow.value ?? 0).toFixed(1),
  };
}

// ─── Activity Stats ─────────────────────────────────────────────────────────

export async function getActivityStats(days: number) {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // DAU
  const dau = await db
    .select({
      date: sql<string>`date_trunc('day', ${streakActivityDays.date})::date::text`,
      count: sql<number>`count(distinct ${streakActivityDays.userId})::int`,
    })
    .from(streakActivityDays)
    .where(and(
      gte(streakActivityDays.date, startDate),
      eq(streakActivityDays.type, 'play'),
    ))
    .groupBy(sql`date_trunc('day', ${streakActivityDays.date})`)
    .orderBy(sql`date_trunc('day', ${streakActivityDays.date})`);

  // Registrations by day
  const registrations = await db
    .select({
      date: sql<string>`date_trunc('day', ${users.createdAt})::date::text`,
      count: sql<number>`count(*)::int`,
    })
    .from(users)
    .where(gte(users.createdAt, startDate))
    .groupBy(sql`date_trunc('day', ${users.createdAt})`)
    .orderBy(sql`date_trunc('day', ${users.createdAt})`);

  // WAU (rolling 7-day window)
  const wauResult = await db.execute(sql`
    WITH daily_users AS (
      SELECT date_trunc('day', date)::date AS d, user_id
      FROM streak_activity_days
      WHERE date >= ${startDate}::timestamp AND type = 'play'
      GROUP BY 1, 2
    ),
    days AS (
      SELECT generate_series(
        ${startDate}::date,
        current_date,
        interval '1 day'
      )::date AS d
    )
    SELECT days.d::text AS date,
           count(DISTINCT daily_users.user_id)::int AS count
    FROM days
    LEFT JOIN daily_users ON daily_users.d BETWEEN days.d - interval '6 days' AND days.d
    GROUP BY days.d
    ORDER BY days.d
  `);

  // MAU (rolling 30-day window)
  const mauResult = await db.execute(sql`
    WITH daily_users AS (
      SELECT date_trunc('day', date)::date AS d, user_id
      FROM streak_activity_days
      WHERE date >= (${startDate}::timestamp - interval '30 days') AND type = 'play'
      GROUP BY 1, 2
    ),
    days AS (
      SELECT generate_series(
        ${startDate}::date,
        current_date,
        interval '1 day'
      )::date AS d
    )
    SELECT days.d::text AS date,
           count(DISTINCT daily_users.user_id)::int AS count
    FROM days
    LEFT JOIN daily_users ON daily_users.d BETWEEN days.d - interval '29 days' AND days.d
    GROUP BY days.d
    ORDER BY days.d
  `);

  // Retention D1, D7, D30
  const retention: Record<string, { cohortSize: number; retained: number; rate: number }> = {};
  for (const d of [1, 7, 30]) {
    const cohortStart = new Date(now.getTime() - (d + 7) * 24 * 60 * 60 * 1000);
    const cohortEnd = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    const result = await db.execute(sql`
      WITH cohort AS (
        SELECT id, created_at FROM users
        WHERE created_at BETWEEN ${cohortStart}::timestamp AND ${cohortEnd}::timestamp
      ),
      retained AS (
        SELECT DISTINCT s.user_id
        FROM streak_activity_days s
        JOIN cohort c ON c.id = s.user_id
        WHERE s.date >= c.created_at + interval '${sql.raw(String(d))} days'
          AND s.date < c.created_at + interval '${sql.raw(String(d + 1))} days'
          AND s.type = 'play'
      )
      SELECT
        (SELECT count(*)::int FROM cohort) AS cohort_size,
        (SELECT count(*)::int FROM retained) AS retained_count
    `);

    const row = (result as unknown as { rows: Array<{ cohort_size: number; retained_count: number }> }).rows[0];
    const cohortSize = Number(row?.cohort_size ?? 0);
    const retainedCount = Number(row?.retained_count ?? 0);
    retention[`day${d}`] = {
      cohortSize,
      retained: retainedCount,
      rate: cohortSize > 0 ? Math.round((retainedCount / cohortSize) * 100) : 0,
    };
  }

  return {
    dau,
    wau: (wauResult as unknown as { rows: unknown[] }).rows,
    mau: (mauResult as unknown as { rows: unknown[] }).rows,
    registrations,
    retention,
  };
}

// ─── Economy Stats ──────────────────────────────────────────────────────────

export async function getEconomyStats() {
  const [totalGemsRow] = await db.select({ value: sum(users.gems) }).from(users);
  const [avgGemsRow] = await db.select({ value: avg(users.gems) }).from(users);
  const [totalFreezesRow] = await db.select({ value: sum(users.streakFreezes) }).from(users);

  const gemsDistResult = await db.execute(sql`
    SELECT
      CASE
        WHEN gems < 100 THEN '0-99'
        WHEN gems < 500 THEN '100-499'
        WHEN gems < 1000 THEN '500-999'
        WHEN gems < 5000 THEN '1000-4999'
        ELSE '5000+'
      END AS bucket,
      count(*)::int AS count
    FROM users
    GROUP BY 1
    ORDER BY min(gems)
  `);

  return {
    totalGems: Number(totalGemsRow.value ?? 0),
    avgGems: Number(avgGemsRow.value ?? 0).toFixed(0),
    totalFreezes: Number(totalFreezesRow.value ?? 0),
    gemsDistribution: (gemsDistResult as unknown as { rows: unknown[] }).rows,
  };
}

// ─── SRS / Learning Stats ───────────────────────────────────────────────────

export async function getSrsStats() {
  const [totalLearnedRow] = await db
    .select({ value: count() })
    .from(userWordProgress)
    .where(isNotNull(userWordProgress.masteredAt));

  const avgLearnedResult = await db.execute(sql`
    SELECT coalesce(avg(cnt), 0)::numeric(10,1) AS value
    FROM (
      SELECT user_id, count(*) AS cnt
      FROM user_word_progress
      WHERE mastered_at IS NOT NULL
      GROUP BY user_id
    ) t
  `);

  const stageDistribution = await db
    .select({
      stage: userWordProgress.srsStage,
      count: sql<number>`count(*)::int`,
    })
    .from(userWordProgress)
    .groupBy(userWordProgress.srsStage)
    .orderBy(userWordProgress.srsStage);

  const accuracyResult = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE is_correct)::int AS correct,
      count(*)::int AS total
    FROM quiz_answers
  `);
  const accRow = (accuracyResult as unknown as { rows: Array<{ correct: number; total: number }> }).rows[0];
  const correct = Number(accRow?.correct ?? 0);
  const total = Number(accRow?.total ?? 0);

  const [penaltyRow] = await db
    .select({ value: count() })
    .from(userWordProgress)
    .where(eq(userWordProgress.hasPenalty, true));

  const [customWordsRow] = await db
    .select({ value: count() })
    .from(userCustomWordProgress);

  return {
    totalLearned: totalLearnedRow.value,
    avgLearnedPerUser: ((avgLearnedResult as unknown as { rows: Array<{ value: string }> }).rows[0]?.value) ?? '0',
    stageDistribution,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
    totalAnswers: total,
    correctAnswers: correct,
    wordsWithPenalty: penaltyRow.value,
    customWordsTotal: customWordsRow.value,
  };
}

// ─── Users List ─────────────────────────────────────────────────────────────

const SORT_COLUMN_MAP: Record<string, string> = {
  id: 'u.id',
  firstName: 'u.first_name',
  level: 'u.level',
  xp: 'u.xp',
  gems: 'u.gems',
  streakDays: 'u.streak_days',
  createdAt: 'u.created_at',
  lastActivityAt: 'u.last_activity_at',
  wordsLearned: '"wordsLearned"',
  quizzesCompleted: '"quizzesCompleted"',
};

export async function getUsersList(opts: {
  page: number;
  limit: number;
  search?: string;
  sort: string;
  order: 'asc' | 'desc';
}) {
  const { page, limit, search, sort, order } = opts;
  const offset = (page - 1) * limit;
  const sortCol = SORT_COLUMN_MAP[sort] ?? 'u.created_at';

  const searchClause = search
    ? sql`WHERE u.first_name ILIKE ${'%' + search + '%'}
        OR u.username ILIKE ${'%' + search + '%'}
        OR u.telegram_id::text LIKE ${'%' + search + '%'}`
    : sql``;

  const countResult = await db.execute(sql`
    SELECT count(*)::int AS total FROM users u ${searchClause}
  `);
  const totalCount = Number((countResult as unknown as { rows: Array<{ total: number }> }).rows[0]?.total ?? 0);

  const result = await db.execute(sql`
    SELECT
      u.id,
      u.telegram_id AS "telegramId",
      u.first_name AS "firstName",
      u.username,
      u.level,
      u.xp,
      u.gems,
      u.streak_days AS "streakDays",
      u.created_at AS "createdAt",
      u.last_activity_at AS "lastActivityAt",
      coalesce(lp.tier, 'bronze') AS "leagueTier",
      coalesce(wp.words_learned, 0)::int AS "wordsLearned",
      coalesce(qs.quizzes_completed, 0)::int AS "quizzesCompleted",
      coalesce(qs.correct_percent, 0)::int AS "correctPercent"
    FROM users u
    LEFT JOIN user_league_progress lp ON lp.user_id = u.id
    LEFT JOIN LATERAL (
      SELECT count(*) AS words_learned
      FROM user_word_progress
      WHERE user_id = u.id AND mastered_at IS NOT NULL
    ) wp ON true
    LEFT JOIN LATERAL (
      SELECT
        count(*) AS quizzes_completed,
        CASE WHEN sum(total_count) > 0
          THEN round(sum(correct_count)::numeric / sum(total_count) * 100)
          ELSE 0
        END AS correct_percent
      FROM quiz_sessions
      WHERE user_id = u.id
    ) qs ON true
    ${searchClause}
    ORDER BY ${sql.raw(sortCol)} ${sql.raw(order)}
    LIMIT ${limit} OFFSET ${offset}
  `);

  return {
    users: (result as unknown as { rows: unknown[] }).rows,
    total: totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit),
  };
}

// ─── User Detail ────────────────────────────────────────────────────────────

export async function getUserDetail(userId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) throw new Error('Пользователь не найден');

  const league = await db.query.userLeagueProgress.findFirst({
    where: eq(userLeagueProgress.userId, userId),
  });

  const [quizStats] = await db
    .select({
      totalSessions: count(),
      totalCorrect: sum(quizSessions.correctCount),
      totalQuestions: sum(quizSessions.totalCount),
      totalXp: sum(quizSessions.xpEarned),
    })
    .from(quizSessions)
    .where(eq(quizSessions.userId, userId));

  const [wordsLearned] = await db
    .select({ value: count() })
    .from(userWordProgress)
    .where(and(eq(userWordProgress.userId, userId), isNotNull(userWordProgress.masteredAt)));

  const [wordsInProgress] = await db
    .select({ value: count() })
    .from(userWordProgress)
    .where(and(
      eq(userWordProgress.userId, userId),
      sql`${userWordProgress.srsStage} > 0`,
      sql`${userWordProgress.masteredAt} IS NULL`,
    ));

  const userStages = await db
    .select({
      stage: userWordProgress.srsStage,
      count: sql<number>`count(*)::int`,
    })
    .from(userWordProgress)
    .where(eq(userWordProgress.userId, userId))
    .groupBy(userWordProgress.srsStage)
    .orderBy(userWordProgress.srsStage);

  const duelResult = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE status = 'finished' AND (challenger_id = ${userId} OR opponent_id = ${userId}))::int AS total_duels,
      count(*) FILTER (WHERE winner_id = ${userId})::int AS duels_won
    FROM duels
    WHERE challenger_id = ${userId} OR opponent_id = ${userId}
  `);
  const duelRow = (duelResult as unknown as { rows: Array<{ total_duels: number; duels_won: number }> }).rows[0];

  return {
    user: {
      ...user,
      telegramId: String(user.telegramId),
    },
    league: league ?? { tier: 'bronze', division: 1 },
    quizStats: {
      totalSessions: quizStats.totalSessions,
      totalCorrect: Number(quizStats.totalCorrect ?? 0),
      totalQuestions: Number(quizStats.totalQuestions ?? 0),
      totalXp: Number(quizStats.totalXp ?? 0),
      correctPercent: Number(quizStats.totalQuestions ?? 0) > 0
        ? Math.round((Number(quizStats.totalCorrect ?? 0) / Number(quizStats.totalQuestions ?? 0)) * 100)
        : 0,
    },
    wordsLearned: wordsLearned.value,
    wordsInProgress: wordsInProgress.value,
    userStages,
    duelStats: {
      total: Number(duelRow?.total_duels ?? 0),
      won: Number(duelRow?.duels_won ?? 0),
    },
  };
}

// ─── User Activity History ──────────────────────────────────────────────────

export async function getUserActivity(userId: number, limit: number) {
  const sessions = await db.query.quizSessions.findMany({
    where: eq(quizSessions.userId, userId),
    orderBy: [desc(quizSessions.startedAt)],
    limit,
    columns: {
      id: true,
      type: true,
      score: true,
      correctCount: true,
      totalCount: true,
      xpEarned: true,
      startedAt: true,
      finishedAt: true,
    },
  });

  const streakHistory = await db.query.streakActivityDays.findMany({
    where: eq(streakActivityDays.userId, userId),
    orderBy: [desc(streakActivityDays.date)],
    limit: 60,
    columns: { date: true, type: true },
  });

  return { sessions, streakHistory };
}

// ─── User Word Progress ─────────────────────────────────────────────────────

export async function getUserWordProgress(userId: number) {
  const result = await db.execute(sql`
    SELECT
      uwp.id,
      uwp.srs_stage AS "srsStage",
      uwp.correct_count AS "correctCount",
      uwp.incorrect_count AS "incorrectCount",
      uwp.has_penalty AS "hasPenalty",
      uwp.mastered_at AS "masteredAt",
      uwp.last_seen_at AS "lastSeenAt",
      w.text AS "wordText",
      wm.translation,
      wm.part_of_speech AS "partOfSpeech"
    FROM user_word_progress uwp
    JOIN word_meanings wm ON wm.id = uwp.meaning_id
    JOIN words w ON w.id = wm.word_id
    WHERE uwp.user_id = ${userId}
    ORDER BY uwp.last_seen_at DESC
    LIMIT 200
  `);

  return { words: (result as unknown as { rows: unknown[] }).rows };
}

// ─── Give Gems ──────────────────────────────────────────────────────────────

export async function giveGems(userId: number, amount: number, _reason: string) {
  const newGems = await addGems(userId, amount);
  return { success: true, newGems };
}
