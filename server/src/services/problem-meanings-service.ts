import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { learningConfig } from '../config/learning-config.js';
import type { LearningTier } from './analytics-service.js';

/**
 * «Проблемные слова» — meaning'и, в которых пользователь стабильно ошибался
 * за последние N дней (см. learning-config.errors).
 *
 * Логика:
 *   - Считаем `is_correct=false` события (question_answered + question_skipped)
 *     из `learning_events` за окно `windowDays`.
 *   - Если ≥ `thresholdCount` ошибок — слово проблемное.
 *   - Выход из коллекции — естественно: лестница продвигает слово вперёд,
 *     ошибки выпадают из окна. Никаких отдельных «exit-условий».
 *
 * НЕ дублирует прогресс: использует learning_events (append-only лог) +
 * userWordProgress только для метаданных (tier, translation, word).
 *
 * Заменяет legacy `getErrorsCollection`/`getErrorsPool` (старая логика
 * `incorrectCount > 0 AND srsStage < 2` без временного окна).
 */

export type ProblemMeaning = {
  meaningId: number;
  word: string;
  translation: string;
  errorCount: number;
  tier: LearningTier;
};

/** Вернуть все проблемные meaning'и пользователя, отсортированные по убыванию ошибок. */
export async function getProblemMeanings(userId: number): Promise<ProblemMeaning[]> {
  const { thresholdCount, windowDays } = learningConfig.errors;

  // Используем raw SQL: drizzle делает join сложным для агрегации с фильтром
  // в HAVING, и читать обычный SQL здесь проще для будущих изменений.
  const result = await db.execute(sql`
    SELECT
      le.meaning_id AS "meaningId",
      COUNT(*) AS "errorCount",
      w.text AS word,
      wm.translation AS translation,
      uwp.learning_tier AS tier
    FROM learning_events le
    JOIN word_meanings wm ON wm.id = le.meaning_id
    JOIN words w ON w.id = wm.word_id
    LEFT JOIN user_word_progress uwp
      ON uwp.user_id = le.user_id AND uwp.meaning_id = le.meaning_id
    WHERE le.user_id = ${userId}
      AND le.event_type IN ('question_answered', 'question_skipped')
      AND le.is_correct = false
      AND le.created_at > now() - (${windowDays}::int * interval '1 day')
      AND le.meaning_id IS NOT NULL
    GROUP BY le.meaning_id, w.text, wm.translation, uwp.learning_tier
    HAVING COUNT(*) >= ${thresholdCount}
    ORDER BY COUNT(*) DESC
  `);

  return (result as unknown as { rows: Array<{
    meaningId: number;
    errorCount: string | number;
    word: string;
    translation: string;
    tier: LearningTier | null;
  }> }).rows.map((r) => ({
    meaningId: Number(r.meaningId),
    word: r.word,
    translation: r.translation,
    errorCount: Number(r.errorCount),
    tier: r.tier ?? 'encounter',
  }));
}

/** Просто число — для бейджа в UI без загрузки списка. */
export async function getProblemMeaningsCount(userId: number): Promise<number> {
  const { thresholdCount, windowDays } = learningConfig.errors;

  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS cnt FROM (
      SELECT le.meaning_id
      FROM learning_events le
      WHERE le.user_id = ${userId}
        AND le.event_type IN ('question_answered', 'question_skipped')
        AND le.is_correct = false
        AND le.created_at > now() - (${windowDays}::int * interval '1 day')
        AND le.meaning_id IS NOT NULL
      GROUP BY le.meaning_id
      HAVING COUNT(*) >= ${thresholdCount}
    ) t
  `);

  const rows = (result as unknown as { rows: Array<{ cnt: number }> }).rows;
  return rows[0]?.cnt ?? 0;
}

/**
 * Выбрать следующее проблемное слово для повторения.
 *
 * В отличие от обычного `pickNextItem`, не учитывает `nextReviewAt` —
 * проблемные слова показываются по запросу, не по расписанию. Берём
 * с наибольшим errorCount, исключая `excludeMeaningIds` (anti-repeat
 * на уровне сессии).
 */
export async function pickNextProblemMeaning(
  userId: number,
  excludeMeaningIds: number[] = [],
): Promise<{ meaningId: number; tier: LearningTier } | null> {
  const { thresholdCount, windowDays } = learningConfig.errors;
  const exclude = excludeMeaningIds.length > 0
    ? sql`AND le.meaning_id NOT IN ${sql.raw('(' + excludeMeaningIds.join(',') + ')')}`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      le.meaning_id AS "meaningId",
      uwp.learning_tier AS tier
    FROM learning_events le
    LEFT JOIN user_word_progress uwp
      ON uwp.user_id = le.user_id AND uwp.meaning_id = le.meaning_id
    WHERE le.user_id = ${userId}
      AND le.event_type IN ('question_answered', 'question_skipped')
      AND le.is_correct = false
      AND le.created_at > now() - (${windowDays}::int * interval '1 day')
      AND le.meaning_id IS NOT NULL
      ${exclude}
    GROUP BY le.meaning_id, uwp.learning_tier
    HAVING COUNT(*) >= ${thresholdCount}
    ORDER BY COUNT(*) DESC
    LIMIT 1
  `);

  const rows = (result as unknown as { rows: Array<{ meaningId: number; tier: LearningTier | null }> }).rows;
  const row = rows[0];
  if (!row) return null;

  return {
    meaningId: Number(row.meaningId),
    tier: row.tier ?? 'encounter',
  };
}
