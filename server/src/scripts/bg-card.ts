import natural from 'natural';

const stem = (w: string) => natural.PorterStemmerRu.stem(w);
const STOPWORDS = new Set(['и','в','на','с','к','о','у','не','но','а','я','мы','он','она','они','это','то','та','тот','тех','те','от','до','из','за','по','для','или','что','как','так','же','бы','был','была','было','были','есть','будет','будут','мне','меня','тебя','тебе','его','ее','её','их','мой','твой','свой','все','всё','этот','эта','эти','кто','чем','чему','если','тогда','потому','хотя','при','над','под','без','про','через','между','один','оба','обе','там','тут','здесь','где','куда','когда','нет','да']);

function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/ё/g, 'е').split(/[^а-я]+/).filter((t) => t.length > 0 && !STOPWORDS.has(t));
}
function key(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, 'е');
  const s = stem(w);
  return s.length >= 3 ? s : w;
}
function matches(sentRu: string, translation: string): boolean {
  const sentKeys = new Set(tokenize(sentRu).map(key));
  const trWords = tokenize(translation).filter((w) => w.length >= 3);
  if (trWords.length === 0) return false;
  return trWords.every((w) => sentKeys.has(key(w)));
}

async function main() {
  const meanings = [
    { id: 31677, translation: 'фон', pos: 'noun', rank: 1, freq: 10 },
    { id: 31678, translation: 'предпосылка', pos: 'noun', rank: 2, freq: 5 },
    { id: 31679, translation: 'происхождение', pos: 'noun', rank: 3, freq: 5 },
    { id: 31696, translation: 'фоновый', pos: 'adj', rank: 1, freq: 10 },
    { id: 31697, translation: 'справочный', pos: 'adj', rank: 2, freq: 5 },
  ];

  const url = 'https://api.tatoeba.org/v1/sentences?lang=eng&q=background&trans:lang=rus&trans:is_direct=yes&sort=relevance&limit=30';
  const resp = await fetch(url, { headers: { 'User-Agent': 'wordy-card' } });
  const data = await resp.json() as any;

  const sentences: { id: number; en: string; ru: string }[] = [];
  for (const s of data.data) {
    if (s.is_unapproved || !s.owner) continue;
    const wc = s.text.split(/\s+/).length;
    if (wc < 3 || wc > 18) continue;
    const flat: any[] = [];
    for (const t of s.translations ?? []) {
      if (Array.isArray(t)) flat.push(...t); else flat.push(t);
    }
    const ru = flat.find((t) => t.lang === 'rus' && !t.is_unapproved);
    if (!ru) continue;
    sentences.push({ id: s.id, en: s.text, ru: ru.text });
  }

  console.log(`Tatoeba returned ${sentences.length} usable sentences\n`);
  for (const m of meanings) {
    console.log(`──────────────────────────────────────────`);
    console.log(`${m.pos.padEnd(4)} #${m.rank} | freq=${m.freq} | ${m.translation}`);
    console.log(`──────────────────────────────────────────`);
    const hits = sentences.filter((s) => matches(s.ru, m.translation));
    if (hits.length === 0) {
      console.log('  (no Tatoeba match)\n');
      continue;
    }
    for (const h of hits.slice(0, 3)) {
      console.log(`  EN: ${h.en}`);
      console.log(`  RU: ${h.ru}\n`);
    }
  }
}

main().catch(console.error);
