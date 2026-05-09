/**
 * Milestone Service
 *
 * Проверяет достижения пользователя и начисляет награды.
 *
 * После Phase D (word-level redesign):
 *   - "wordsLearned" считается на уровне слов через `userWordProgressWord`.
 *     Слово считается выученным когда оно достигло tier='review'
 *     или state='known_from_review'.
 *   - "totalAnswers" суммирует счётчики из обеих таблиц
 *     (`userWordProgress` для L4/review, `userWordProgressWord` для L1-L3).
 *     У backfill-пользователей возможна небольшая дублирующая инфляция —
 *     приемлемо, метрики milestone завязаны на круглые пороги.
 *   - CEFR-уровень определяется per-word: каждому слову присваивается
 *     минимальный CEFR его meanings (= «самый базовый смысл слова»).
 */
import { eq, sql, and, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userWordProgress, userWordProgressWord, wordMeanings } from '../db/schema.js';
import { getNewlyReachedMilestones, type MilestoneConfig } from '../config/milestones-config.js';
import { PILOT_FEATURES } from '../config/pilot-config.js';
import { addGems } from './progression-service.js';

/**
 * Проверяет непоказанные milestones и начисляет награды.
 * Возвращает массив только что достигнутых milestones (может быть пустым).
 */
export async function checkAndAwardMilestones(userId: number): Promise<MilestoneConfig[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      streakDays: true,
      shownMilestones: true,
    },
  });

  if (!user) return [];

  const shownMilestones = (user.shownMilestones ?? []) as string[];

  // ─── wordsLearned: word-level через userWordProgressWord ──────────────────
  // Слово выучено, если tier='review' (прошло L1-L4) или state='known_from_review'
  // (отмечено через обзор/онбординг). Исключаем from_placement=true (отметка
  // через placement-тест не считается «реальным» обучением).
  const [wordsRow] = await db
    .select({
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(userWordProgressWord)
    .where(
      and(
        eq(userWordProgressWord.userId, userId),
        eq(userWordProgressWord.fromPlacement, false),
        sql`(${userWordProgressWord.learningTier} = 'review' OR ${userWordProgressWord.state} = 'known_from_review')`,
      ),
    );
  const wordsLearned = Number(wordsRow?.count ?? 0);

  // ─── totalAnswers: сумма по обеим таблицам ────────────────────────────────
  // userWordProgress отвечает за L4 production + per-meaning review;
  // userWordProgressWord — за L1-L3.
  const [meaningAnswersRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${userWordProgress.correctCount} + ${userWordProgress.incorrectCount}), 0)`.as(
        'total',
      ),
    })
    .from(userWordProgress)
    .where(and(eq(userWordProgress.userId, userId), eq(userWordProgress.fromPlacement, false)));

  const [wordAnswersRow] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${userWordProgressWord.correctCount} + ${userWordProgressWord.incorrectCount}), 0)`.as(
        'total',
      ),
    })
    .from(userWordProgressWord)
    .where(
      and(
        eq(userWordProgressWord.userId, userId),
        eq(userWordProgressWord.fromPlacement, false),
      ),
    );

  const totalAnswers = Number(meaningAnswersRow?.total ?? 0) + Number(wordAnswersRow?.total ?? 0);

  // ─── CEFR per-word ─────────────────────────────────────────────────────────
  // Для каждого слова берём MIN CEFR его meanings (минимальный = «базовый» смысл).
  // Считаем сколько слов на уровне всего и сколько из них выучено.
  // Уровень считается «пройденным» при ≥80% выученных.
  const wordCefrSq = db
    .select({
      wordId: wordMeanings.wordId,
      cefrRank: sql<number>`MIN(CASE ${wordMeanings.cefr}
        WHEN 'a1' THEN 1 WHEN 'a2' THEN 2 WHEN 'b1' THEN 3
        WHEN 'b2' THEN 4 WHEN 'c1' THEN 5 WHEN 'c2' THEN 6
        ELSE 99 END)`.as('cefr_rank'),
    })
    .from(wordMeanings)
    .where(isNotNull(wordMeanings.cefr))
    .groupBy(wordMeanings.wordId)
    .as('word_cefr');

  const cefrRows = await db
    .select({
      cefrRank: wordCefrSq.cefrRank,
      totalWords: sql<number>`COUNT(*)`.as('total_words'),
      learnedWords: sql<number>`COUNT(CASE
        WHEN ${userWordProgressWord.fromPlacement} = false
          AND (${userWordProgressWord.learningTier} = 'review' OR ${userWordProgressWord.state} = 'known_from_review')
        THEN 1 END)`.as('learned_words'),
    })
    .from(wordCefrSq)
    .leftJoin(
      userWordProgressWord,
      sql`${userWordProgressWord.wordId} = ${wordCefrSq.wordId} AND ${userWordProgressWord.userId} = ${userId}`,
    )
    .where(sql`${wordCefrSq.cefrRank} < 99`)
    .groupBy(wordCefrSq.cefrRank)
    .orderBy(wordCefrSq.cefrRank);

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

  const newMilestones = getNewlyReachedMilestones(shownMilestones, {
    wordsLearned,
    streakDays: user.streakDays,
    totalAnswers,
    cefrLevel,
  });

  if (newMilestones.length === 0) return [];

  let totalGems = 0;
  if (PILOT_FEATURES.gems) {
    for (const milestone of newMilestones) {
      totalGems += milestone.gemsReward;
    }
    if (totalGems > 0) {
      await addGems(userId, totalGems);
    }
  }

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
