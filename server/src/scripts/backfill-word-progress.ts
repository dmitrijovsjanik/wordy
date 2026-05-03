/**
 * Backfill: агрегация существующих user_word_progress (per-meaning) в новую
 * user_word_progress_word (per-word).
 *
 * Стратегия (одобрена пользователем):
 *   1. learning_tier: max-tier (review > production > active > passive > encounter)
 *   2. correct_count, incorrect_count, tier_correct_count: с meaning'а с
 *      max-tier; тай-брейкер при равенстве — max correct_count
 *   3. review_stage: если max-tier=review → MIN review_stage среди
 *      review-meanings (защита от «вроде выучено, но скоро отвалится»);
 *      иначе 0
 *   4. next_review_at: соответствует выбранному review_stage (если review)
 *      или взят с тай-брейкер meaning'а
 *   5. has_penalty: OR по всем meanings слова
 *   6. from_placement: OR по всем meanings слова
 *   7. state: all known_from_review → known_from_review;
 *             any learning → learning;
 *             else snoozed
 *   8. snoozed_until: если state=snoozed → MIN snoozed_until среди
 *                     snoozed meanings (самое раннее)
 *   9. mastered_at: MAX masteredAt среди всех meanings
 *  10. last_seen_at: MAX
 *  11. created_at: MIN (самое раннее)
 *
 * Идемпотентен: ON CONFLICT (user_id, word_id) DO NOTHING. Повторный запуск
 * не перезатирает существующие word-progress записи.
 *
 * Запуск: cd server && npx tsx src/scripts/backfill-word-progress.ts
 *         или с --dry-run для предпросмотра без записи
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userWordProgress, userWordProgressWord, wordMeanings } from '../db/schema.js';
import { eq } from 'drizzle-orm';

type LearningTier = 'encounter' | 'passive' | 'active' | 'production' | 'review';
type LearningState = 'learning' | 'known_from_review' | 'snoozed';

const TIER_RANK: Record<LearningTier, number> = {
  encounter: 0,
  passive: 1,
  active: 2,
  production: 3,
  review: 4,
};

type MeaningRow = {
  meaningId: number;
  wordId: number;
  learningTier: LearningTier;
  tierCorrectCount: number;
  reviewStage: number;
  state: LearningState;
  snoozedUntil: Date | null;
  nextReviewAt: Date | null;
  hasPenalty: boolean;
  masteredAt: Date | null;
  fromPlacement: boolean;
  lastSeenAt: Date;
  correctCount: number;
  incorrectCount: number;
  createdAt: Date;
};

type AggregateRow = {
  userId: number;
  wordId: number;
  learningTier: LearningTier;
  tierCorrectCount: number;
  reviewStage: number;
  state: LearningState;
  snoozedUntil: Date | null;
  nextReviewAt: Date | null;
  hasPenalty: boolean;
  masteredAt: Date | null;
  fromPlacement: boolean;
  lastSeenAt: Date;
  correctCount: number;
  incorrectCount: number;
  createdAt: Date;
  /** Для логов/спот-чека — сколько meanings агрегировано. */
  meaningCount: number;
};

function aggregateWord(meanings: MeaningRow[]): Omit<AggregateRow, 'userId' | 'wordId' | 'meaningCount'> {
  // 1. max-tier
  const maxTierMeanings = (() => {
    const maxRank = Math.max(...meanings.map(m => TIER_RANK[m.learningTier]));
    return meanings.filter(m => TIER_RANK[m.learningTier] === maxRank);
  })();
  const tier: LearningTier = maxTierMeanings[0]!.learningTier;

  // 2. тай-брейкер — max correct_count среди max-tier-meanings
  const chosen = maxTierMeanings.reduce((best, m) =>
    m.correctCount > best.correctCount ? m : best
  , maxTierMeanings[0]!);

  // 3. review_stage: если review — MIN среди review-meanings, иначе 0
  let reviewStage = 0;
  let nextReviewAt: Date | null = chosen.nextReviewAt;
  if (tier === 'review') {
    const reviewMeanings = meanings.filter(m => m.learningTier === 'review');
    const minStage = Math.min(...reviewMeanings.map(m => m.reviewStage));
    reviewStage = minStage;
    // nextReviewAt — у meaning'а с этим минимальным stage
    const stageMeaning = reviewMeanings.find(m => m.reviewStage === minStage)!;
    nextReviewAt = stageMeaning.nextReviewAt;
  }

  // 5. has_penalty: OR
  const hasPenalty = meanings.some(m => m.hasPenalty);

  // 6. from_placement: OR
  const fromPlacement = meanings.some(m => m.fromPlacement);

  // 7. state
  let state: LearningState;
  if (meanings.every(m => m.state === 'known_from_review')) {
    state = 'known_from_review';
  } else if (meanings.some(m => m.state === 'learning')) {
    state = 'learning';
  } else {
    state = 'snoozed';
  }

  // 8. snoozed_until: MIN среди snoozed (если state=snoozed)
  let snoozedUntil: Date | null = null;
  if (state === 'snoozed') {
    const snoozedMeanings = meanings.filter(m => m.state === 'snoozed' && m.snoozedUntil);
    if (snoozedMeanings.length > 0) {
      snoozedUntil = snoozedMeanings.reduce((min, m) =>
        m.snoozedUntil! < min ? m.snoozedUntil! : min
      , snoozedMeanings[0]!.snoozedUntil!);
    }
  }

  // 9. mastered_at: MAX
  const masteredDates = meanings.map(m => m.masteredAt).filter((d): d is Date => d !== null);
  const masteredAt = masteredDates.length > 0
    ? new Date(Math.max(...masteredDates.map(d => d.getTime())))
    : null;

  // 10. last_seen_at: MAX
  const lastSeenAt = new Date(Math.max(...meanings.map(m => m.lastSeenAt.getTime())));

  // 11. created_at: MIN
  const createdAt = new Date(Math.min(...meanings.map(m => m.createdAt.getTime())));

  return {
    learningTier: tier,
    tierCorrectCount: chosen.tierCorrectCount,
    reviewStage,
    state,
    snoozedUntil,
    nextReviewAt,
    hasPenalty,
    masteredAt,
    fromPlacement,
    lastSeenAt,
    correctCount: chosen.correctCount,
    incorrectCount: chosen.incorrectCount,
    createdAt,
  };
}

async function loadMeanings(): Promise<Map<string, MeaningRow[]>> {
  const rows = await db
    .select({
      userId: userWordProgress.userId,
      meaningId: userWordProgress.meaningId,
      wordId: wordMeanings.wordId,
      learningTier: userWordProgress.learningTier,
      tierCorrectCount: userWordProgress.tierCorrectCount,
      reviewStage: userWordProgress.reviewStage,
      state: userWordProgress.state,
      snoozedUntil: userWordProgress.snoozedUntil,
      nextReviewAt: userWordProgress.nextReviewAt,
      hasPenalty: userWordProgress.hasPenalty,
      masteredAt: userWordProgress.masteredAt,
      fromPlacement: userWordProgress.fromPlacement,
      lastSeenAt: userWordProgress.lastSeenAt,
      correctCount: userWordProgress.correctCount,
      incorrectCount: userWordProgress.incorrectCount,
      createdAt: userWordProgress.createdAt,
    })
    .from(userWordProgress)
    .innerJoin(wordMeanings, eq(wordMeanings.id, userWordProgress.meaningId));

  // Group by (userId, wordId).
  const grouped = new Map<string, { userId: number; wordId: number; meanings: MeaningRow[] }>();
  for (const r of rows) {
    const key = `${r.userId}:${r.wordId}`;
    if (!grouped.has(key)) {
      grouped.set(key, { userId: r.userId, wordId: r.wordId, meanings: [] });
    }
    grouped.get(key)!.meanings.push({
      meaningId: r.meaningId,
      wordId: r.wordId,
      learningTier: r.learningTier as LearningTier,
      tierCorrectCount: r.tierCorrectCount,
      reviewStage: r.reviewStage,
      state: r.state as LearningState,
      snoozedUntil: r.snoozedUntil,
      nextReviewAt: r.nextReviewAt,
      hasPenalty: r.hasPenalty,
      masteredAt: r.masteredAt,
      fromPlacement: r.fromPlacement,
      lastSeenAt: r.lastSeenAt,
      correctCount: r.correctCount,
      incorrectCount: r.incorrectCount,
      createdAt: r.createdAt,
    });
  }

  // Convert to plain map for return.
  const out = new Map<string, MeaningRow[]>();
  for (const [k, v] of grouped) out.set(k, v.meanings);
  return out;
}

async function run(dryRun: boolean) {
  console.log(`[backfill] start (dryRun=${dryRun})`);

  const grouped = await loadMeanings();
  console.log(`[backfill] loaded ${grouped.size} unique (user, word) pairs from user_word_progress`);

  let inserted = 0;
  let skipped = 0;
  const tierStats: Record<LearningTier, number> = {
    encounter: 0, passive: 0, active: 0, production: 0, review: 0,
  };

  for (const [key, meanings] of grouped) {
    const [userIdStr, wordIdStr] = key.split(':');
    const userId = Number(userIdStr);
    const wordId = Number(wordIdStr);
    const agg = aggregateWord(meanings);

    tierStats[agg.learningTier]++;

    if (dryRun) {
      continue;
    }

    // ON CONFLICT … RETURNING id: возвращает строку только если INSERT произошёл
    // (т.е. конфликт не сработал). Drizzle/postgres-js не предоставляет
    // надёжного `rowCount` через query builder, поэтому считаем по returning.
    const inserted_rows = await db
      .insert(userWordProgressWord)
      .values({
        userId,
        wordId,
        ...agg,
      })
      .onConflictDoNothing()
      .returning({ id: userWordProgressWord.id });
    if (inserted_rows.length > 0) {
      inserted++;
    } else {
      skipped++;
    }
  }

  console.log(`[backfill] tier distribution:`, tierStats);
  console.log(`[backfill] inserted=${inserted}, skipped (already exist)=${skipped}, total processed=${grouped.size}`);

  // Спот-чек: 5 случайных слов с показом meanings → aggregate.
  const sample = Array.from(grouped.entries()).sort(() => Math.random() - 0.5).slice(0, 5);
  console.log(`\n[backfill] sample 5 (user, word) для ручной проверки:`);
  for (const [key, meanings] of sample) {
    const [userIdStr, wordIdStr] = key.split(':');
    const wordRows = await db.execute(sql`SELECT text FROM words WHERE id = ${Number(wordIdStr)}`);
    const wordText = (wordRows as unknown as { rows: Array<{ text: string }> }).rows[0]?.text ?? '?';
    const agg = aggregateWord(meanings);
    console.log(`\nuser=${userIdStr}, word=${wordIdStr} (${wordText}):`);
    console.log(`  meanings (${meanings.length}):`);
    for (const m of meanings) {
      console.log(`    meaning_id=${m.meaningId} tier=${m.learningTier} tcc=${m.tierCorrectCount} corr=${m.correctCount} review_stage=${m.reviewStage} state=${m.state}`);
    }
    console.log(`  → aggregate: tier=${agg.learningTier} tcc=${agg.tierCorrectCount} corr=${agg.correctCount} review_stage=${agg.reviewStage} state=${agg.state} penalty=${agg.hasPenalty}`);
  }

  console.log(`\n[backfill] done`);
}

const dryRun = process.argv.includes('--dry-run');
run(dryRun).then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
