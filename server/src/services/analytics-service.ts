import { sql, eq, and, gte } from 'drizzle-orm';
import { db } from '../db/index.js';
import { learningEvents } from '../db/schema.js';

// Тип события совпадает с pg-enum learning_event_type. Дублируем здесь как
// тип-литерал, чтобы не плодить циклические импорты со схемой.
export type LearningEventType =
  | 'session_started'
  | 'session_finished'
  | 'question_shown'
  | 'question_answered'
  | 'question_skipped'
  | 'tier_advanced'
  | 'tier_reset'
  | 'meaning_learned'
  | 'meaning_relearn'
  | 'review_swiped_known'
  | 'review_swiped_unknown'
  | 'review_swiped_snooze'
  | 'review_undo'
  | 'mnemonic_revealed'
  | 'onboarding_step';

export type LearningTier = 'encounter' | 'passive' | 'active' | 'production' | 'review';

export type LearningEventInput = {
  userId: number;
  eventType: LearningEventType;
  meaningId?: number | null;
  tierBefore?: LearningTier | null;
  tierAfter?: LearningTier | null;
  questionType?: string | null;
  isCorrect?: boolean | null;
  answerTimeMs?: number | null;
  payload?: Record<string, unknown> | null;
};

/**
 * Записать событие в `learning_events`. Append-only, не редактируется.
 *
 * Никогда не бросает наружу: аналитика не должна ронять учебный поток.
 * Ошибки логируются в console — этого достаточно для текущего масштаба.
 */
export async function recordEvent(event: LearningEventInput): Promise<void> {
  try {
    await db.insert(learningEvents).values({
      userId: event.userId,
      eventType: event.eventType,
      meaningId: event.meaningId ?? null,
      tierBefore: event.tierBefore ?? null,
      tierAfter: event.tierAfter ?? null,
      questionType: event.questionType ?? null,
      isCorrect: event.isCorrect ?? null,
      answerTimeMs: event.answerTimeMs ?? null,
      payload: event.payload ?? null,
    });
  } catch (err) {
    // Не валим основной поток. Логируем и идём дальше.
    console.error('[analytics] recordEvent failed:', err);
  }
}

// ─── Aggregations (для admin-view, не для горячего пути) ────────────────────

/** Распределение типов вопросов за последние N дней. Считаем по `question_shown`. */
export async function getQuestionTypeDistribution(days: number = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({
      questionType: learningEvents.questionType,
      shown: sql<number>`count(*)::int`,
    })
    .from(learningEvents)
    .where(and(
      eq(learningEvents.eventType, 'question_shown'),
      gte(learningEvents.createdAt, since),
    ))
    .groupBy(learningEvents.questionType);

  const total = rows.reduce((sum, r) => sum + Number(r.shown ?? 0), 0);
  return rows
    .map(r => ({
      questionType: r.questionType ?? 'unknown',
      shown: Number(r.shown),
      pct: total > 0 ? Math.round((Number(r.shown) / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.shown - a.shown);
}

/**
 * Funnel первой сессии для когорты "появились в `learning_events` за последние N дней".
 *
 * Считаем долю юзеров, прошедших каждую ступень:
 *  1. Любое событие
 *  2. Хотя бы 1 question_answered
 *  3. ≥ 5 question_answered
 *  4. ≥ 20 question_answered
 *
 * Это прокси для "вовлечённости в первой сессии" — числа считаем за всё время
 * существования юзера в таблице, не по календарным окнам.
 */
export async function getFirstSessionFunnel(days: number = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await db.execute(sql`
    WITH cohort AS (
      SELECT DISTINCT user_id
      FROM learning_events
      WHERE created_at >= ${since}
    ),
    answers AS (
      SELECT user_id, count(*) FILTER (WHERE event_type = 'question_answered') AS n_answers
      FROM learning_events
      WHERE user_id IN (SELECT user_id FROM cohort)
      GROUP BY user_id
    )
    SELECT
      (SELECT count(*) FROM cohort)::int                                      AS reached_any_event,
      (SELECT count(*) FROM answers WHERE n_answers >= 1)::int                AS answered_1plus,
      (SELECT count(*) FROM answers WHERE n_answers >= 5)::int                AS answered_5plus,
      (SELECT count(*) FROM answers WHERE n_answers >= 20)::int               AS answered_20plus
  `);
  const row = (result as unknown as { rows: Array<{ reached_any_event: number; answered_1plus: number; answered_5plus: number; answered_20plus: number }> }).rows[0];
  return {
    reachedAnyEvent: Number(row?.reached_any_event ?? 0),
    answered1plus: Number(row?.answered_1plus ?? 0),
    answered5plus: Number(row?.answered_5plus ?? 0),
    answered20plus: Number(row?.answered_20plus ?? 0),
  };
}

/**
 * Retention из `learning_events`. Окно когорты — [now - (D + 7 дней) ... now - D дней].
 * "Удержан" = есть хотя бы одно событие на день D после регистрации (createAt пользователя).
 *
 * Параллельный источник — `streak_activity_days` (admin-service.getActivityStats),
 * но `streak_activity_days` пишется только при завершённой сессии, что отличается
 * от "юзер вернулся и хоть что-то сделал". Этот метод даёт более широкое определение retention.
 */
export async function getLearningRetention(d: number) {
  const cohortStart = new Date(Date.now() - (d + 7) * 24 * 60 * 60 * 1000);
  const cohortEnd = new Date(Date.now() - d * 24 * 60 * 60 * 1000);

  const result = await db.execute(sql`
    WITH cohort AS (
      SELECT id, created_at FROM users
      WHERE created_at BETWEEN ${cohortStart}::timestamp AND ${cohortEnd}::timestamp
    ),
    retained AS (
      SELECT DISTINCT le.user_id
      FROM learning_events le
      JOIN cohort c ON c.id = le.user_id
      WHERE le.created_at >= c.created_at + (${sql.raw(String(d))} || ' days')::interval
        AND le.created_at <  c.created_at + (${sql.raw(String(d + 1))} || ' days')::interval
    )
    SELECT
      (SELECT count(*)::int FROM cohort)   AS cohort_size,
      (SELECT count(*)::int FROM retained) AS retained_count
  `);

  const row = (result as unknown as { rows: Array<{ cohort_size: number; retained_count: number }> }).rows[0];
  const cohortSize = Number(row?.cohort_size ?? 0);
  const retainedCount = Number(row?.retained_count ?? 0);
  return {
    day: d,
    cohortSize,
    retained: retainedCount,
    rate: cohortSize > 0 ? Math.round((retainedCount / cohortSize) * 1000) / 10 : 0,
  };
}

/** Краткая сводка для админ-дашборда: D1/D7/D30 + распределение типов + funnel. */
export async function getLearningAnalyticsSummary() {
  const [d1, d7, d30, qtypes, funnel] = await Promise.all([
    getLearningRetention(1),
    getLearningRetention(7),
    getLearningRetention(30),
    getQuestionTypeDistribution(7),
    getFirstSessionFunnel(30),
  ]);
  return { retention: { d1, d7, d30 }, questionTypes: qtypes, funnel };
}
