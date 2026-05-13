import { eq } from 'drizzle-orm';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import natural from 'natural';
import { words, wordMeanings } from '../db/schema.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/wordy',
});
const db = drizzle(pool);

const stem = (w: string) => natural.PorterStemmerRu.stem(w);

// Русские служебные слова, не несущие смысла для матчинга
const STOPWORDS = new Set([
  'и', 'в', 'на', 'с', 'к', 'о', 'у', 'не', 'но', 'а', 'я', 'мы', 'он',
  'она', 'они', 'это', 'то', 'та', 'тот', 'тех', 'те', 'от', 'до', 'из',
  'за', 'по', 'для', 'или', 'что', 'как', 'так', 'же', 'бы', 'был', 'была',
  'было', 'были', 'есть', 'будет', 'будут', 'мне', 'меня', 'тебя', 'тебе',
  'его', 'ее', 'её', 'их', 'мой', 'твой', 'свой', 'все', 'всё', 'этот',
  'эта', 'эти', 'кто', 'чем', 'чему', 'если', 'тогда', 'потому', 'хотя',
  'при', 'над', 'под', 'без', 'про', 'через', 'между', 'один', 'два',
  'один', 'оба', 'обе', 'там', 'тут', 'здесь', 'где', 'куда', 'когда',
  'нет', 'да',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, 'е')
    .split(/[^а-я]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

// Ключ для матчинга: всегда пробуем стем, но если он "слишком короткий" — fallback.
// Snowball-стем длиной ≥ 3 принимаем; иначе используем исходное слово.
// Это даёт фон/фона/фоном → фон (правильное схлопывание), но опыт→оп → fallback "опыт".
function key(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  const s = stem(w);
  return s.length >= 3 ? s : w;
}

function meaningKeys(translation: string, synonyms: string[] | null): { required: string[][]; bonus: string[] } {
  // required[i] — массив возможных ключей для i-го слова перевода (любой подходит).
  // Включаем сам перевод (каждое содержательное слово) и синонимы как "бонусные" (любой совпадает).
  const trWords = tokenize(translation).filter((w) => w.length >= 3);
  const required = trWords.map((w) => [key(w)]);

  const synKeys: string[] = [];
  for (const syn of synonyms ?? []) {
    for (const w of tokenize(syn).filter((x) => x.length >= 3)) {
      synKeys.push(key(w));
    }
  }
  return { required, bonus: synKeys };
}

type MatchResult = {
  matched: boolean;
  via: 'translation' | 'synonym' | null;
};

function matchSentence(
  sentenceRu: string,
  translation: string,
  synonyms: string[] | null
): MatchResult {
  const sentKeys = new Set(tokenize(sentenceRu).map(key));
  const { required, bonus } = meaningKeys(translation, synonyms);

  if (required.length === 0) return { matched: false, via: null };

  // Все слова перевода должны иметь exact-совпадение хотя бы с одним ключом предложения
  const allMatch = required.every((alts) => alts.some((k) => sentKeys.has(k)));
  if (allMatch) return { matched: true, via: 'translation' };

  // Synonyms-fallback убран: дает много ложных срабатываний из-за того, что
  // однокоренные слова разных частей речи (крайний/крайне/крайность/крайняя степень)
  // схлопываются стеммером в один ключ. Без него покрытие меньше, но точность выше.
  void bonus;
  return { matched: false, via: null };
}

type Sentence = { id: number; text: string; ru: string; owner: string | null };

async function fetchTatoeba(word: string): Promise<Sentence[]> {
  const url =
    `https://api.tatoeba.org/v1/sentences` +
    `?lang=eng&q=${encodeURIComponent(word)}` +
    `&trans:lang=rus&trans:is_direct=yes` +
    `&sort=relevance&limit=30`;
  const resp = await fetch(url, { headers: { 'User-Agent': 'wordy-dry-run' } });
  if (!resp.ok) {
    console.error(`  HTTP ${resp.status}`);
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

    out.push({ id: s.id, text: s.text, ru: ru.text, owner: s.owner });
  }
  return out;
}

async function processWord(wordText: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`WORD: ${wordText}`);
  console.log('='.repeat(80));

  const [word] = await db.select().from(words).where(eq(words.text, wordText)).limit(1);
  if (!word) return;

  const meanings = await db.select().from(wordMeanings).where(eq(wordMeanings.wordId, word.id));
  const sentences = await fetchTatoeba(wordText);
  console.log(`  ${meanings.length} meanings, ${sentences.length} sentences after filters`);

  if (sentences.length === 0) {
    console.log('  no sentences');
    return;
  }

  // Считаем все совпадения: sentence × meaning
  type Hit = { sentence: Sentence; via: 'translation' | 'synonym' };
  const hitsPerMeaning = new Map<number, Hit[]>();
  for (const m of meanings) hitsPerMeaning.set(m.id, []);

  // Также: к скольким миниингам каждое предложение привязано (для ранжирования)
  const meaningIdsPerSentence = new Map<number, number[]>();
  for (const s of sentences) meaningIdsPerSentence.set(s.id, []);

  for (const s of sentences) {
    for (const m of meanings) {
      const r = matchSentence(s.ru, m.translation, m.synonyms);
      if (r.matched) {
        hitsPerMeaning.get(m.id)!.push({ sentence: s, via: r.via! });
        meaningIdsPerSentence.get(s.id)!.push(m.id);
      }
    }
  }

  // Тай-брейк: если предложение совпало с N миниингами, оставляем его только в самом популярном
  // (с минимальным popularityRank). Иначе одно предложение раздаётся в 5 разных смыслов и теряется
  // ценность дифференциации.
  const meaningById = new Map(meanings.map((m) => [m.id, m]));
  const finalHits = new Map<number, Hit[]>();
  for (const m of meanings) finalHits.set(m.id, []);

  // Без агрессивного тай-брейка: при exact-only matching одно предложение редко цепляет
  // больше 1-2 миниингов, и если уж зацепило — это семантически близкие смыслы,
  // которым полезно иметь общий пример (спариваться/спариться/совокупление).
  for (const [sentId, mIds] of meaningIdsPerSentence) {
    for (const mId of mIds) {
      const hit = hitsPerMeaning.get(mId)!.find((h) => h.sentence.id === sentId)!;
      finalHits.get(mId)!.push(hit);
    }
  }
  void meaningById;

  // Печать
  const byPos = new Map<string, typeof meanings>();
  for (const m of meanings) {
    const list = byPos.get(m.partOfSpeech) ?? [];
    list.push(m);
    byPos.set(m.partOfSpeech, list);
  }

  let totalCovered = 0;
  let totalSaved = 0;
  const usedIds = new Set<number>();

  for (const [pos, list] of byPos) {
    console.log(`\n  --- ${pos} (${list.length}) ---`);
    list.sort((a, b) => (a.popularityRank ?? 99) - (b.popularityRank ?? 99));
    for (const m of list) {
      const hits = finalHits.get(m.id)!;
      const all = hitsPerMeaning.get(m.id)!;
      const trimmed = hits.slice(0, 3);
      const status = trimmed.length > 0 ? '✓' : '·';
      const synBadge = trimmed.some((h) => h.via === 'synonym') ? ' [via syn]' : '';
      const filteredOut = all.length - hits.length;
      const filterNote = filteredOut > 0 ? ` (${filteredOut} перешли к более популярным)` : '';
      console.log(
        `    ${status} [${pos} #${m.popularityRank ?? '?'}] ${m.translation}  → ${trimmed.length} examples${synBadge}${filterNote}`
      );
      for (const h of trimmed) {
        console.log(`        EN: ${h.sentence.text}`);
        console.log(`        RU: ${h.sentence.ru}`);
        usedIds.add(h.sentence.id);
      }
      if (trimmed.length > 0) {
        totalCovered++;
        totalSaved += trimmed.length;
      }
    }
  }

  const unused = sentences.filter((s) => !usedIds.has(s.id));
  console.log(`\n  --- SUMMARY for "${wordText}" ---`);
  console.log(`    covered ${totalCovered}/${meanings.length} (${Math.round((100 * totalCovered) / meanings.length)}%)`);
  console.log(`    ${totalSaved} examples would be saved`);
  console.log(`    ${unused.length} unused sentences:`);
  for (const s of unused.slice(0, 5)) {
    console.log(`        EN: ${s.text}`);
    console.log(`        RU: ${s.ru}`);
  }
}

async function main() {
  for (const w of ['background', 'mate', 'extreme', 'house', 'time']) {
    await processWord(w);
    await new Promise((r) => setTimeout(r, 1100));
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
