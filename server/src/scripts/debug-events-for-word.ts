/**
 * Диагностика: полная история событий по одному слову.
 * Запуск: cd server && npx tsx src/scripts/debug-events-for-word.ts <wordId> [userId]
 */
import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

const wordId = Number(process.argv[2]);
const userId = Number(process.argv[3] ?? 1);

if (!Number.isFinite(wordId)) {
  console.error('Usage: npx tsx debug-events-for-word.ts <wordId> [userId]');
  process.exit(1);
}

// События на слово напрямую через word_id.
const wordEvents = await db.execute(sql`
  SELECT id, event_type, payload, tier_before, tier_after, question_type,
         is_correct, answer_time_ms, created_at, meaning_id, word_id
  FROM learning_events
  WHERE word_id = ${wordId} AND user_id = ${userId}
  ORDER BY created_at ASC, id ASC
`);

// События на любые meanings этого слова (на случай, если что-то записывалось через meaning-level).
const meaningEvents = await db.execute(sql`
  SELECT le.id, le.event_type, le.payload, le.tier_before, le.tier_after,
         le.question_type, le.is_correct, le.answer_time_ms, le.created_at,
         le.meaning_id, le.word_id, wm.translation
  FROM learning_events le
  JOIN word_meanings wm ON wm.id = le.meaning_id
  WHERE wm.word_id = ${wordId} AND le.user_id = ${userId}
  ORDER BY le.created_at ASC, le.id ASC
`);

type Row = {
  id: number;
  event_type: string;
  payload: unknown;
  tier_before: string | null;
  tier_after: string | null;
  question_type: string | null;
  is_correct: boolean | null;
  answer_time_ms: number | null;
  created_at: Date | string;
  meaning_id: number | null;
  word_id: number | null;
  translation?: string;
};

function toDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

const wordRows = (wordEvents as unknown as { rows: Row[] }).rows;
const meaningRows = (meaningEvents as unknown as { rows: Row[] }).rows;

console.log(`\n[debug] word_id=${wordId} user=${userId}`);
console.log(`Events tied to word_id=${wordId}: ${wordRows.length}`);
console.log(`Events tied to any meaning of word ${wordId}: ${meaningRows.length}\n`);

const seen = new Set<number>();
const merged: Row[] = [];
for (const r of [...wordRows, ...meaningRows]) {
  if (seen.has(r.id)) continue;
  seen.add(r.id);
  merged.push(r);
}
merged.sort((a, b) => {
  const t = toDate(a.created_at).getTime() - toDate(b.created_at).getTime();
  if (t !== 0) return t;
  return a.id - b.id;
});

console.log(`─── merged timeline (${merged.length} events) ───`);
console.log(
  `${'#'.padEnd(3)}| ${'time'.padEnd(24)}| ${'event_type'.padEnd(22)}| ${'wId'.padEnd(5)}| ${'mId'.padEnd(5)}| ${'tier_before→after'.padEnd(22)}| iC | qType         | payload`,
);
console.log('─'.repeat(180));

for (let i = 0; i < merged.length; i++) {
  const r = merged[i]!;
  const tierTrans = r.tier_before || r.tier_after
    ? `${(r.tier_before ?? '·').padEnd(10)}→${(r.tier_after ?? '·').padEnd(10)}`
    : '· · ·                ';
  const ic = r.is_correct === null ? '·' : r.is_correct ? 'Y' : 'N';
  const payloadStr = r.payload === null ? '·' : JSON.stringify(r.payload);
  console.log(
    `${String(i + 1).padEnd(3)}| ${toDate(r.created_at).toISOString().padEnd(24)}| ${r.event_type.padEnd(22)}| ${String(r.word_id ?? '').padEnd(5)}| ${String(r.meaning_id ?? '').padEnd(5)}| ${tierTrans.padEnd(22)}| ${ic.padEnd(2)} | ${(r.question_type ?? '').padEnd(13)} | ${payloadStr}`,
  );
}

// Анализ: сколько question_answered с isCorrect=true и =false?
const answered = merged.filter((r) => r.event_type === 'question_answered');
const correctAns = answered.filter((r) => r.is_correct === true).length;
const wrongAns = answered.filter((r) => r.is_correct === false).length;
const skipped = merged.filter((r) => r.event_type === 'question_skipped').length;
const shown = merged.filter((r) => r.event_type === 'question_shown').length;
const advanced = merged.filter((r) => r.event_type === 'tier_advanced').length;
const reset = merged.filter((r) => r.event_type === 'tier_reset').length;

console.log('\n─── summary ───');
console.log(`question_shown:    ${shown}`);
console.log(`question_answered: ${answered.length} (correct=${correctAns}, wrong=${wrongAns})`);
console.log(`question_skipped:  ${skipped}`);
console.log(`tier_advanced:     ${advanced}`);
console.log(`tier_reset:        ${reset}`);

process.exit(0);
