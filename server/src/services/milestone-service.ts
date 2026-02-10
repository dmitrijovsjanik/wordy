/**
 * Milestone Service
 *
 * Проверяет достижения пользователя и начисляет награды.
 */

import { eq, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userWordProgress, wordMeanings } from '../db/schema.js';
import { getNewlyReachedMilestones, type MilestoneConfig } from '../config/milestones-config.js';
import { addGems } from './progression-service.js';

/**
 * Проверяет непоказанные milestones и начисляет награды.
 * Возвращает массив только что достигнутых milestones (может быть пустым).
 */
export async function checkAndAwardMilestones(userId: number): Promise<MilestoneConfig[]> {
  // Получаем данные пользователя
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      streakDays: true,
      shownMilestones: true,
    },
  });

  if (!user) return [];

  const shownMilestones = (user.shownMilestones ?? []) as string[];

  // Считаем выученные слова (srsStage >= 3), исключая помеченные через онбординг
  const [wordsRow] = await db
    .select({
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(userWordProgress)
    .where(
      sql`${userWordProgress.userId} = ${userId} AND ${userWordProgress.srsStage} >= 3 AND ${userWordProgress.fromPlacement} = false`,
    );
  const wordsLearned = Number(wordsRow?.count ?? 0);

  // Считаем общее количество ответов (исключая онбординг)
  const [answersRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${userWordProgress.correctCount} + ${userWordProgress.incorrectCount}), 0)`.as('total'),
    })
    .from(userWordProgress)
    .where(
      sql`${userWordProgress.userId} = ${userId} AND ${userWordProgress.fromPlacement} = false`,
    );
  const totalAnswers = Number(answersRow?.total ?? 0);

  // Определяем CEFR-уровень (сколько уровней пройдено с >=80%)
  const cefrRows = await db
    .select({
      cefrLevel: wordMeanings.cefr,
      totalWords: sql<number>`COUNT(DISTINCT ${wordMeanings.id})`.as('total_words'),
      learnedWords: sql<number>`COUNT(DISTINCT CASE WHEN ${userWordProgress.srsStage} >= 3 AND ${userWordProgress.fromPlacement} = false THEN ${wordMeanings.id} END)`.as('learned_words'),
    })
    .from(wordMeanings)
    .leftJoin(
      userWordProgress,
      sql`${userWordProgress.meaningId} = ${wordMeanings.id} AND ${userWordProgress.userId} = ${userId}`,
    )
    .where(isNotNull(wordMeanings.cefr))
    .groupBy(wordMeanings.cefr)
    .orderBy(
      sql`CASE ${wordMeanings.cefr}
        WHEN 'a1' THEN 1 WHEN 'a2' THEN 2 WHEN 'b1' THEN 3
        WHEN 'b2' THEN 4 WHEN 'c1' THEN 5 ELSE 6 END`,
    );

  let cefrLevel = 0;
  for (const row of cefrRows) {
    const total = Number(row.totalWords);
    const learned = Number(row.learnedWords);
    const percent = total > 0 ? (learned / total) * 100 : 0;
    if (percent >= 80) {
      cefrLevel++;
    } else {
      break; // Уровни должны быть последовательными
    }
  }

  // Находим новые milestones
  const newMilestones = getNewlyReachedMilestones(shownMilestones, {
    wordsLearned,
    streakDays: user.streakDays,
    totalAnswers,
    cefrLevel,
  });

  if (newMilestones.length === 0) return [];

  // Начисляем награды
  let totalGems = 0;
  for (const milestone of newMilestones) {
    totalGems += milestone.gemsReward;
  }
  if (totalGems > 0) {
    await addGems(userId, totalGems);
  }

  // Обновляем shownMilestones
  const updatedShown = [...shownMilestones, ...newMilestones.map((m) => m.id)];
  await db
    .update(users)
    .set({
      shownMilestones: updatedShown,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return newMilestones;
}
