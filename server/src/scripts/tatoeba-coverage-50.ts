import { eq, sql, isNotNull } from 'drizzle-orm';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import natural from 'natural';
import { words, wordMeanings } from '../db/schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});
const db = drizzle(pool);

const stem = (w: string) => natural.PorterStemmerRu.stem(w);

const STOPWORDS = new Set([
  'и','в','на','с','к','о','у','не','но','а','я','мы','он','она','они','это','то','та','тот',
  'тех','те','от','до','из','за','по','для','или','что','как','так','же','бы','был','была','было',
  'были','есть','будет','будут','мне','меня','тебя','тебе','его','ее','её','их','мой','твой','свой',
  'все','всё','этот','эта','эти','кто','чем','чему','если','тогда','потому','хотя','при','над','под',
  'без','про','через','между','один','оба','обе','там','тут','здесь','где','куда','когда','нет','да',
]);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/ё/g, 'е').split(/[^а-я]+/).filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

function key(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  const s = stem(w);
  return s.length >= 3 ? s : w;
}

function matchSentence(sentenceRu: string, translation: string): boolean {
  const sentKeys = new Set(tokenize(sentenceRu).map(key));
  const trWords = tokenize(translation).filter((w) => w.length >= 3);
  if (trWords.length === 0) return false;
  return trWords.every((w) => sentKeys.has(key(w)));
}

type Sentence = { id: number; ru: string };

async function fetchTatoeba(word: string): Promise<Sentence[]> {
  const url =
    `https://api.tatoeba.org/v1/sentences?lang=eng&q=${encodeURIComponent(word)}` +
    `&trans:lang=rus&trans:is_direct=yes&sort=relevance&limit=30`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'wordy-cov' } });
  if (!resp.ok) return [];
  const data = (await resp.json()) as { data: Array<{ id: number; text: string; is_unapproved?: boolean; owner: string|null; translations?: unknown }> };

  const out: Sentence[] = [];
  for (const s of data.data) {
    if (s.is_unapproved) continue;
    if (!s.owner) continue;
    const wc = s.text.split(/\s+/).length;
    if (wc < 3 || wc > 18) continue;
    const flat: Array<{ lang: string; text: string; is_unapproved?: boolean }> = [];
    for (const t of (s.translations as unknown[]) ?? []) {
      if (Array.isArray(t)) flat.push(...(t as typeof flat));
      else flat.push(t as (typeof flat)[number]);
    }
    const ru = flat.find((t) => t.lang === 'rus' && !t.is_unapproved);
    if (!ru) continue;
    out.push({ id: s.id, ru: ru.text });
  }
  return out;
}

type Filter = { name: string; fn: (m: { freq: number | null; rank: number | null }) => boolean };

const FILTERS: Filter[] = [
  { name: 'no_filter',           fn: () => true },
  { name: 'freq>=5',             fn: (m) => (m.freq ?? 0) >= 5 },
  { name: 'freq=10',             fn: (m) => (m.freq ?? 0) >= 10 },
  { name: 'freq>=5 AND rank<=3', fn: (m) => (m.freq ?? 0) >= 5 && (m.rank ?? 99) <= 3 },
  { name: 'freq>=5 AND rank<=5', fn: (m) => (m.freq ?? 0) >= 5 && (m.rank ?? 99) <= 5 },
  { name: 'rank<=3',             fn: (m) => (m.rank ?? 99) <= 3 },
];

type Stat = { kept: number; covered: number };

async function main() {
  // Pick 50 random single-word, top-3000 frequency words
  const sample = await db.execute(sql<{ id: number; text: string }>`
    SELECT w.id, w.text
    FROM ${words} w
    WHERE w.frequency_rank IS NOT NULL
      AND w.text NOT LIKE '% %'
      AND w.frequency_rank <= 3000
    ORDER BY random()
    LIMIT 50
  `);
  void isNotNull;

  const wordList = sample.rows as Array<{ id: number; text: string }>;
  console.log(`Sampled ${wordList.length} words`);

  // Aggregate stats per filter
  const aggregate = new Map<string, Stat>();
  for (const f of FILTERS) aggregate.set(f.name, { kept: 0, covered: 0 });

  // Per-word output
  const perWord: Array<Record<string, string | number>> = [];

  for (let i = 0; i < wordList.length; i++) {
    const w = wordList[i]!;
    process.stdout.write(`[${i+1}/${wordList.length}] ${w.text.padEnd(20)}`);

    const ms = (await db.select({
      id: wordMeanings.id,
      translation: wordMeanings.translation,
      pos: wordMeanings.partOfSpeech,
      rank: wordMeanings.popularityRank,
      freq: wordMeanings.frequency,
    }).from(wordMeanings).where(eq(wordMeanings.wordId, w.id))) as Array<{ id: number; translation: string; pos: string; rank: number | null; freq: number | null }>;

    const sentences = await fetchTatoeba(w.text);
    process.stdout.write(`  ${ms.length} meanings, ${sentences.length} sentences`);

    // Compute matched meanings
    const matchedIds = new Set<number>();
    for (const m of ms) {
      for (const s of sentences) {
        if (matchSentence(s.ru, m.translation)) {
          matchedIds.add(m.id);
          break;
        }
      }
    }

    const row: Record<string, string | number> = { word: w.text, total: ms.length };
    for (const f of FILTERS) {
      const kept = ms.filter(f.fn);
      const covered = kept.filter((m) => matchedIds.has(m.id)).length;
      const agg = aggregate.get(f.name)!;
      agg.kept += kept.length;
      agg.covered += covered;
      row[`${f.name}_kept`] = kept.length;
      row[`${f.name}_cov`] = covered;
      row[`${f.name}_pct`] = kept.length > 0 ? Math.round(100 * covered / kept.length) : 0;
    }
    perWord.push(row);

    process.stdout.write(`  matched=${matchedIds.size}\n`);
    await new Promise((r) => setTimeout(r, 1100));
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('AGGREGATED RESULTS (50 random words)');
  console.log('='.repeat(80));
  console.log(`${'Filter'.padEnd(28)} ${'kept'.padStart(7)} ${'covered'.padStart(8)} ${'cov%'.padStart(7)}`);
  console.log('-'.repeat(60));
  for (const f of FILTERS) {
    const agg = aggregate.get(f.name)!;
    const pct = agg.kept > 0 ? Math.round(100 * agg.covered / agg.kept) : 0;
    console.log(`${f.name.padEnd(28)} ${String(agg.kept).padStart(7)} ${String(agg.covered).padStart(8)} ${(pct + '%').padStart(7)}`);
  }

  // Per-word coverage table for the most interesting filter
  console.log('\n' + '='.repeat(80));
  console.log('PER-WORD breakdown (sorted by total meanings desc):');
  console.log('='.repeat(80));
  console.log(`${'word'.padEnd(18)} ${'all'.padStart(4)} ${'f>=5'.padStart(6)} ${'f=10'.padStart(6)} ${'f5r3'.padStart(6)} ${'f5r5'.padStart(6)} ${'r<=3'.padStart(6)}`);
  perWord.sort((a, b) => (b.total as number) - (a.total as number));
  for (const r of perWord) {
    console.log(
      `${String(r.word).padEnd(18)} ${String(r.total).padStart(3)}  ` +
      `${(r['no_filter_cov'] + '/' + r['no_filter_kept']).padStart(5)}  ` +
      `${(r['freq>=5_cov'] + '/' + r['freq>=5_kept']).padStart(5)}  ` +
      `${(r['freq=10_cov'] + '/' + r['freq=10_kept']).padStart(5)}  ` +
      `${(r['freq>=5 AND rank<=3_cov'] + '/' + r['freq>=5 AND rank<=3_kept']).padStart(5)}  ` +
      `${(r['freq>=5 AND rank<=5_cov'] + '/' + r['freq>=5 AND rank<=5_kept']).padStart(5)}  ` +
      `${(r['rank<=3_cov'] + '/' + r['rank<=3_kept']).padStart(5)}`
    );
  }

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
