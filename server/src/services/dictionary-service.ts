import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { words, wordMeanings } from '../db/schema.js';
import { sourceLang, targetLang } from '../types/language.js';

// ─── Yandex Dictionary API Types ────────────────────────────────────────────

type YandexTranslation = {
  text: string;
  pos?: string;
  syn?: { text: string }[];
  mean?: { text: string }[];
  ex?: { text: string; tr: { text: string }[] }[];
};

type YandexDefinition = {
  text: string;
  pos?: string;
  ts?: string;
  tr: YandexTranslation[];
};

type YandexDictionaryResponse = {
  head: Record<string, unknown>;
  def: YandexDefinition[];
};

// ─── Public Types ───────────────────────────────────────────────────────────

type MeaningResult = {
  id: number | null;
  translation: string;
  partOfSpeech: string;
  examples: { text: string; translation: string }[];
  synonyms: string[];
};

export type LookupResult = {
  word: string;
  transcription: string | null;
  lang: string;
  meanings: MeaningResult[];
  savedToDb: boolean;
};

// ─── POS Mapping ────────────────────────────────────────────────────────────

const POS_MAP: Record<string, 'noun' | 'verb' | 'adj' | 'adv' | 'phrase'> = {
  noun: 'noun',
  verb: 'verb',
  adjective: 'adj',
  adverb: 'adv',
  participle: 'verb',
  'прилагательное': 'adj',
  'существительное': 'noun',
  'глагол': 'verb',
  'наречие': 'adv',
};

function mapPos(pos: string | undefined): 'noun' | 'verb' | 'adj' | 'adv' | 'phrase' {
  if (!pos) return 'noun';
  return POS_MAP[pos.toLowerCase()] ?? 'phrase';
}

// ─── Language Detection ─────────────────────────────────────────────────────

const CYRILLIC_RE = /[а-яёА-ЯЁ]/;

function detectLang(text: string): string {
  return CYRILLIC_RE.test(text) ? 'ru-en' : 'en-ru';
}

// ─── Lookup ─────────────────────────────────────────────────────────────────

const YANDEX_API_URL = 'https://dictionary.yandex.net/api/v1/dicservice.json/lookup';

export async function lookup(text: string, langOverride?: string): Promise<LookupResult> {
  const apiKey = process.env.YANDEX_DICTIONARY_API_KEY;
  if (!apiKey) {
    throw new Error('YANDEX_DICTIONARY_API_KEY не задан');
  }

  const query = text.trim().toLowerCase();
  const lang = langOverride ?? detectLang(query);

  // Для прямого направления (source→target): проверяем БД по слову
  // Для обратного (target→source): пропускаем кеш — нужен API
  const src = sourceLang(lang);
  const tgt = targetLang(lang);
  const isForward = !CYRILLIC_RE.test(query) || src !== 'ru';
  if (isForward) {
    const existing = await findInDb(query);
    if (existing) return { ...existing, lang };
  }

  // Запрос к Yandex Dictionary API
  const url = `${YANDEX_API_URL}?key=${encodeURIComponent(apiKey)}&lang=${lang}&text=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Yandex Dictionary API error: ${response.status}`);
  }

  const data = (await response.json()) as YandexDictionaryResponse;

  if (data.def.length === 0) {
    return { word: query, transcription: null, lang, meanings: [], savedToDb: false };
  }

  const transcription = data.def[0]?.ts ?? null;
  const meanings: MeaningResult[] = [];

  for (const def of data.def) {
    const pos = mapPos(def.pos);

    for (const tr of def.tr) {
      const examples = (tr.ex ?? []).map((ex) => ({
        text: ex.text,
        translation: ex.tr?.[0]?.text ?? '',
      }));

      const synonyms = (tr.syn ?? []).map((s) => s.text);

      meanings.push({
        id: null,
        translation: tr.text,
        partOfSpeech: pos,
        examples,
        synonyms,
      });
    }
  }

  // Сохраняем в БД
  // en-ru: word = query (английское), translation = русское
  // ru-en: word = tr.text (английское), translation = query (русское)
  let savedMeanings: MeaningResult[];
  let savedToDb = false;
  try {
    savedMeanings = isForward
      ? await saveToDb(query, meanings, src, tgt)
      : await saveRuEnToDb(query, data, src, tgt);
    savedToDb = true;
  } catch (err) {
    console.error('Failed to save to DB, returning API results:', err);
    savedMeanings = meanings;
  }

  return {
    word: query,
    transcription,
    lang,
    meanings: savedMeanings,
    savedToDb,
  };
}

// ─── DB Helpers ─────────────────────────────────────────────────────────────

async function findInDb(text: string): Promise<Omit<LookupResult, 'lang'> | null> {
  const word = await db.query.words.findFirst({
    where: eq(words.text, text),
    with: { meanings: true },
  });

  if (!word || word.meanings.length === 0) return null;

  return {
    word: word.text,
    transcription: null,
    meanings: word.meanings.map((m) => ({
      id: m.id,
      translation: m.translation,
      partOfSpeech: m.partOfSpeech,
      examples: m.contextExample
        ? [{ text: m.contextExample, translation: '' }]
        : [],
      synonyms: [],
    })),
    savedToDb: false,
  };
}

async function saveToDb(text: string, meanings: MeaningResult[], wordLang: string, translationLang: string): Promise<MeaningResult[]> {
  let [word] = await db
    .select()
    .from(words)
    .where(eq(words.text, text))
    .limit(1);

  if (!word) {
    [word] = await db
      .insert(words)
      .values({ text, language: wordLang })
      .returning();
  }

  const result: MeaningResult[] = [];

  for (const meaning of meanings) {
    const existing = await db
      .select()
      .from(wordMeanings)
      .where(
        and(
          eq(wordMeanings.wordId, word!.id),
          eq(wordMeanings.translation, meaning.translation),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      result.push({ ...meaning, id: existing[0]!.id });
      continue;
    }

    const [inserted] = await db
      .insert(wordMeanings)
      .values({
        wordId: word!.id,
        translation: meaning.translation,
        translationLanguage: translationLang,
        partOfSpeech: meaning.partOfSpeech as 'noun' | 'verb' | 'adj' | 'adv' | 'phrase',
        contextExample: meaning.examples[0]?.text ?? null,
        difficulty: 'medium',
      })
      .returning();

    result.push({ ...meaning, id: inserted!.id });
  }

  return result;
}

// Обратное направление: пользователь ввёл слово на target-языке, API вернул переводы на source
async function saveRuEnToDb(ruQuery: string, data: YandexDictionaryResponse, _srcLang: string, tgtLang: string): Promise<MeaningResult[]> {
  const result: MeaningResult[] = [];

  for (const def of data.def) {
    const pos = mapPos(def.pos);

    for (const tr of def.tr) {
      const enWord = tr.text.toLowerCase();

      // Upsert английское слово
      let [word] = await db
        .select()
        .from(words)
        .where(eq(words.text, enWord))
        .limit(1);

      if (!word) {
        [word] = await db
          .insert(words)
          .values({ text: enWord, language: tgtLang })
          .returning();
      }

      // Проверяем, есть ли уже значение с русским переводом
      const existing = await db
        .select()
        .from(wordMeanings)
        .where(
          and(
            eq(wordMeanings.wordId, word!.id),
            eq(wordMeanings.translation, ruQuery),
          ),
        )
        .limit(1);

      const examples = (tr.ex ?? []).map((ex) => ({
        text: ex.text,
        translation: ex.tr?.[0]?.text ?? '',
      }));

      const synonyms = (tr.syn ?? []).map((s) => s.text);

      if (existing.length > 0) {
        result.push({
          id: existing[0]!.id,
          translation: tr.text,
          partOfSpeech: pos,
          examples,
          synonyms,
        });
        continue;
      }

      const [inserted] = await db
        .insert(wordMeanings)
        .values({
          wordId: word!.id,
          translation: ruQuery,
          translationLanguage: _srcLang,
          partOfSpeech: pos,
          contextExample: examples[0]?.text ?? null,
          difficulty: 'medium',
        })
        .returning();

      result.push({
        id: inserted!.id,
        translation: tr.text,
        partOfSpeech: pos,
        examples,
        synonyms,
      });
    }
  }

  return result;
}
