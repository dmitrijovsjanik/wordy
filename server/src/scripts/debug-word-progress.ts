/**
 * Диагностика: показать word-level прогресс пользователя.
 * Запуск: cd server && npx tsx src/scripts/debug-word-progress.ts [userId]
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

const userId = Number(process.argv[2] ?? 1);

const result = await db.execute(sql`
  SELECT
    uwpw.word_id,
    w.text AS word,
    uwpw.learning_tier,
    uwpw.tier_correct_count AS tcc,
    uwpw.correct_count AS correct,
    uwpw.incorrect_count AS incorrect,
    uwpw.has_penalty,
    uwpw.state,
    uwpw.next_review_at,
    uwpw.last_seen_at
  FROM user_word_progress_word uwpw
  JOIN words w ON w.id = uwpw.word_id
  WHERE uwpw.user_id = ${userId}
  ORDER BY
    CASE uwpw.learning_tier
      WHEN 'encounter' THEN 0
      WHEN 'passive'   THEN 1
      WHEN 'active'    THEN 2
      WHEN 'production' THEN 3
      WHEN 'review'    THEN 4
      ELSE 5
    END,
    uwpw.tier_correct_count DESC,
    uwpw.word_id
`);

const rows = (result as unknown as { rows: Array<{
  word_id: number;
  word: string;
  learning_tier: string;
  tcc: number;
  correct: number;
  incorrect: number;
  has_penalty: boolean;
  state: string;
  next_review_at: Date | null;
  last_seen_at: Date | null;
}> }).rows;

console.log(`\n[debug] user=${userId}, total rows=${rows.length}\n`);

// Группировка по tier для агрегатов.
const byTier = new Map<string, typeof rows>();
for (const r of rows) {
  if (!byTier.has(r.learning_tier)) byTier.set(r.learning_tier, []);
  byTier.get(r.learning_tier)!.push(r);
}

console.log('─── totals by tier ───');
for (const [tier, group] of byTier) {
  const tccDist = group.reduce<Record<number, number>>((acc, r) => {
    acc[r.tcc] = (acc[r.tcc] ?? 0) + 1;
    return acc;
  }, {});
  const tccPart = Object.entries(tccDist).map(([k, v]) => `tcc=${k}:${v}`).join(' ');
  console.log(`  ${tier.padEnd(11)} | ${group.length.toString().padStart(3)} слов | ${tccPart}`);
}

console.log('\n─── строки (first 50) ───');
console.log(
  `${'word_id'.padEnd(8)}| ${'word'.padEnd(20)}| ${'tier'.padEnd(11)}| tcc | corr | inc | pen | state            | next_review_at`,
);
console.log('─'.repeat(140));

for (const r of rows.slice(0, 50)) {
  const nra = r.next_review_at ? new Date(r.next_review_at).toISOString() : 'null';
  console.log(
    `${String(r.word_id).padEnd(8)}| ${r.word.padEnd(20)}| ${r.learning_tier.padEnd(11)}| ${String(r.tcc).padStart(3)} | ${String(r.correct).padStart(4)} | ${String(r.incorrect).padStart(3)} | ${r.has_penalty ? 'Y' : '.'}   | ${r.state.padEnd(17)}| ${nra}`,
  );
}

if (rows.length > 50) {
  console.log(`\n... ещё ${rows.length - 50} строк не показаны`);
}

process.exit(0);
