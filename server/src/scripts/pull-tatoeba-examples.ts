/**
 * Tatoeba seed script.
 *
 * Идёт по миннингам с фильтром freq>=5 AND rank<=3 (даёт ~52% покрытия по
 * Tatoeba против ~95% пустых yandex-примеров), стэммит EN-слово, тянет
 * предложения из Tatoeba, и матчит RU-перевод по Snowball стемам.
 *
 * Идемпотентно: пропускает миннинги, у которых уже есть examples или
 * contextExample (источник: AI или Yandex — не перетираем).
 *
 * Usage:
 *   tsx pull-tatoeba-examples.ts                        # все слова, write-mode
 *   tsx pull-tatoeba-examples.ts --dry-run              # без записи в БД
 *   tsx pull-tatoeba-examples.ts --limit 20             # 20 слов, остановиться
 *   tsx pull-tatoeba-examples.ts --word run play time   # только эти слова
 *
 * Rate: 5 RPS (200ms между запросами). Tatoeba официально не лимитирует,
 * но мы хорошие соседи.
 */
import { eq, sql, isNull, or, and, isNotNull, inArray } from 'drizzle-orm';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import natural from 'natural';
import { words, wordMeanings } from '../db/schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});
const db = drizzle(pool);

// ─── CLI ─────────────────────────────────────────────────────────────────────

type Args = {
  dryRun: boolean;
  limit: number | null;
  words: string[] | null;
  rateMs: number;
};

function parseArgs(argv: string[]): Args {
  const a: Args = { dryRun: false, limit: null, words: null, rateMs: 200 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--dry-run') a.dryRun = true;
    else if (arg === '--limit') a.limit = Number(argv[++i]);
    else if (arg === '--rate-ms') a.rateMs = Number(argv[++i]);
    else if (arg === '--word') {
      a.words = [];
      while (i + 1 < argv.length && !argv[i + 1]!.startsWith('--')) {
        a.words.push(argv[++i]!);
      }
    } else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(1);
    }
  }
  return a;
}

// ─── Matcher (lifted from tatoeba-dry-run.ts) ───────────────────────────────

const stem = (w: string) => natural.PorterStemmerRu.stem(w);

const STOPWORDS = new Set([
  'и', 'в', 'на', 'с', 'к', 'о', 'у', 'не', 'но', 'а', 'я', 'мы', 'он',
  'она', 'они', 'это', 'то', 'та', 'тот', 'тех', 'те', 'от', 'до', 'из',
  'за', 'по', 'для', 'или', 'что', 'как', 'так', 'же', 'бы', 'был', 'была',
  'было', 'были', 'есть', 'будет', 'будут', 'мне', 'меня', 'тебя', 'тебе',
  'его', 'ее', 'её', 'их', 'мой', 'твой', 'свой', 'все', 'всё', 'этот',
  'эта', 'эти', 'кто', 'чем', 'чему', 'если', 'тогда', 'потому', 'хотя',
  'при', 'над', 'под', 'без', 'про', 'через', 'между', 'один', 'два',
  'оба', 'обе', 'там', 'тут', 'здесь', 'где', 'куда', 'когда',
  'нет', 'да',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^а-я]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
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

// ─── Tatoeba API ────────────────────────────────────────────────────────────

type Sentence = { id: number; text: string; ru: string };

async function fetchTatoeba(word: string): Promise<Sentence[]> {
  const url =
    `https://api.tatoeba.org/v1/sentences` +
    `?lang=eng&q=${encodeURIComponent(word)}` +
    `&trans:lang=rus&trans:is_direct=yes` +
    `&sort=relevance&limit=30`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'wordy-seed' } });
  if (!resp.ok) {
    console.error(`  [${word}] HTTP ${resp.status}`);
    return [];
  }
  const data = (await resp.json()) as {
    data: Array<{
      id: number;
      text: string;
      is_unapproved?: boolean;
      owner: string | null;
      translations?: unknown;
    }>;
  };

  const out: Sentence[] = [];
  for (const s of data.data) {
    if (s.is_unapproved) continue;
    if (!s.owner) continue;
    const wc = s.text.split(/\s+/).length;
    if (wc < 3 || wc > 18) continue;

    const flat: Array<{ lang: string; text: string; is_direct?: boolean; is_unapproved?: boolean }> = [];
    for (const t of (s.translations as unknown[]) ?? []) {
      if (Array.isArray(t)) flat.push(...(t as typeof flat));
      else flat.push(t as (typeof flat)[number]);
    }
    const ru = flat.find((t) => t.lang === 'rus' && !t.is_unapproved);
    if (!ru) continue;

    out.push({ id: s.id, text: s.text, ru: ru.text });
  }
  return out;
}

// ─── Main flow ──────────────────────────────────────────────────────────────

type Meaning = {
  id: number;
  translation: string;
  popularityRank: number | null;
  freq: number | null;
};

type WordRow = { id: number; text: string };

const MAX_EXAMPLES_PER_MEANING = 3;

async function processWord(
  word: WordRow,
  args: Args,
  stats: { wordsHit: number; meaningsCovered: number; examplesWritten: number },
): Promise<void> {
  // Достаём eligible meanings (freq>=5, rank<=3), у которых пусто и examples,
  // и contextExample. Если хоть один источник заполнен — не трогаем (precedence).
  const meanings = (await db
    .select({
      id: wordMeanings.id,
      translation: wordMeanings.translation,
      popularityRank: wordMeanings.popularityRank,
      freq: wordMeanings.frequency,
    })
    .from(wordMeanings)
    .where(
      and(
        eq(wordMeanings.wordId, word.id),
        sql`${wordMeanings.frequency} >= 5`,
        sql`${wordMeanings.popularityRank} <= 3`,
        isNull(wordMeanings.contextExample),
        or(isNull(wordMeanings.examples), sql`jsonb_array_length(${wordMeanings.examples}) = 0`),
      ),
    )) as Meaning[];

  if (meanings.length === 0) return;

  const sentences = await fetchTatoeba(word.text);
  if (sentences.length === 0) return;

  // Сортируем миннинги по rank (популярные раньше) — при пересечении
  // совпадений предложение остаётся в более популярном.
  meanings.sort((a, b) => (a.popularityRank ?? 99) - (b.popularityRank ?? 99));

  const usedSentenceIds = new Set<number>();
  let wordCovered = false;

  for (const m of meanings) {
    const hits: { text: string; translation: string }[] = [];
    for (const s of sentences) {
      if (usedSentenceIds.has(s.id)) continue;
      if (matchSentence(s.ru, m.translation)) {
        hits.push({ text: s.text, translation: s.ru });
        usedSentenceIds.add(s.id);
        if (hits.length >= MAX_EXAMPLES_PER_MEANING) break;
      }
    }
    if (hits.length === 0) continue;

    if (!args.dryRun) {
      await db
        .update(wordMeanings)
        .set({
          examples: hits,
          contextExample: hits[0]!.text,
          updatedAt: new Date(),
        })
        .where(eq(wordMeanings.id, m.id));
    }
    stats.meaningsCovered++;
    stats.examplesWritten += hits.length;
    wordCovered = true;
  }

  if (wordCovered) stats.wordsHit++;
}

async function loadEligibleWords(args: Args): Promise<WordRow[]> {
  if (args.words && args.words.length > 0) {
    return (await db
      .select({ id: words.id, text: words.text })
      .from(words)
      .where(inArray(words.text, args.words))) as WordRow[];
  }

  // Eligible = есть хотя бы один меннинг с freq>=5, rank<=3 и пустыми примерами.
  // Служебные слова (a/an/the + предлоги/союзы/частицы) исключаем —
  // для них Snowball-матчер шумный, да и в учебном потоке они не идут.
  // SELECT DISTINCT требует frequency_rank в select-list для ORDER BY.
  const rows = (await db
    .selectDistinct({ id: words.id, text: words.text, rank: words.frequencyRank })
    .from(words)
    .innerJoin(wordMeanings, eq(wordMeanings.wordId, words.id))
    .where(
      and(
        isNotNull(words.frequencyRank),
        sql`${words.text} NOT LIKE '% %'`,
        sql`${words.text} NOT IN ('a', 'an', 'the')`,
        sql`(${wordMeanings.translationPartOfSpeech} IS NULL OR ${wordMeanings.translationPartOfSpeech} NOT IN ('preposition', 'conjunction', 'particle', 'interjection', 'parenthetic', 'invariable', 'adverbial participle'))`,
        sql`${wordMeanings.frequency} >= 5`,
        sql`${wordMeanings.popularityRank} <= 3`,
        isNull(wordMeanings.contextExample),
        or(isNull(wordMeanings.examples), sql`jsonb_array_length(${wordMeanings.examples}) = 0`),
      ),
    )
    .orderBy(words.frequencyRank)) as Array<WordRow & { rank: number }>;

  const stripped = rows.map((r) => ({ id: r.id, text: r.text }));
  return args.limit ? stripped.slice(0, args.limit) : stripped;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('\n=== Tatoeba seed ===');
  console.log(`mode: ${args.dryRun ? 'DRY-RUN (no writes)' : 'WRITE'}`);
  console.log(`rate: ${args.rateMs}ms between requests (~${Math.round(1000 / args.rateMs)} RPS)`);
  if (args.words) console.log(`words: ${args.words.join(', ')}`);
  if (args.limit) console.log(`limit: ${args.limit}`);

  const wordList = await loadEligibleWords(args);
  console.log(`eligible words: ${wordList.length}\n`);

  if (wordList.length === 0) {
    await pool.end();
    return;
  }

  const stats = { wordsHit: 0, meaningsCovered: 0, examplesWritten: 0 };
  const t0 = Date.now();

  for (let i = 0; i < wordList.length; i++) {
    const w = wordList[i]!;
    process.stdout.write(`[${i + 1}/${wordList.length}] ${w.text.padEnd(22)} `);

    try {
      await processWord(w, args, stats);
    } catch (err) {
      console.error(`\n  error on "${w.text}":`, err);
    }

    const elapsed = Math.round((Date.now() - t0) / 1000);
    const rate = i + 1 > 0 ? Math.round(((i + 1) / elapsed) * 60) : 0;
    process.stdout.write(`  hit=${stats.wordsHit} mns=${stats.meaningsCovered} ex=${stats.examplesWritten}  [${elapsed}s, ~${rate}/min]\n`);

    if (i + 1 < wordList.length) {
      await new Promise((r) => setTimeout(r, args.rateMs));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`words processed:  ${wordList.length}`);
  console.log(`words with hits:  ${stats.wordsHit} (${Math.round((100 * stats.wordsHit) / wordList.length)}%)`);
  console.log(`meanings covered: ${stats.meaningsCovered}`);
  console.log(`examples written: ${stats.examplesWritten}`);
  console.log(`mode:             ${args.dryRun ? 'DRY-RUN — nothing written' : 'WRITE — DB updated'}`);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
