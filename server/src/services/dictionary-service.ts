import { eq, and } from 'drizzle-orm';
import lemmatizer from 'wink-lemmatizer';
import { db } from '../db/index.js';
import { words, wordMeanings } from '../db/schema.js';
import { sourceLang, targetLang } from '../types/language.js';

// ─── Lemmatization ───────────────────────────────────────────────────────────

function lemmatize(text: string): string[] {
  const word = text.trim().toLowerCase();

  // Фразы не лемматизируем в runtime lookup
  if (word.includes(' ')) return [word];

  // Пробуем разные части речи
  const forms = new Set<string>([word]);
  forms.add(lemmatizer.noun(word));
  forms.add(lemmatizer.verb(word));
  forms.add(lemmatizer.adjective(word));

  return [...forms].filter(Boolean);
}

// ─── Yandex Dictionary API Types ────────────────────────────────────────────

type YandexTranslation = {
  text: string;
  pos?: string;
  fr?: number; // frequency: 1-10, чем выше — тем популярнее
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
  translationPartOfSpeech: string | null; // часть речи перевода (tr[].pos)
  frequency: number | null;
  meaningHints: string[]; // английские слова-уточнения (mean из API)
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

type LookupOptions = {
  lang?: string;
  skipCache?: boolean; // Для enrich: всегда запрашивать API
};

export async function lookup(text: string, options?: LookupOptions): Promise<LookupResult> {
  const apiKey = process.env.YANDEX_DICTIONARY_API_KEY;
  if (!apiKey) {
    throw new Error('YANDEX_DICTIONARY_API_KEY не задан');
  }

  const query = text.trim().toLowerCase();
  const lang = options?.lang ?? detectLang(query);
  const skipCache = options?.skipCache ?? false;

  // Для прямого направления (source→target): проверяем БД по слову
  // Для обратного (target→source): пропускаем кеш — нужен API
  const src = sourceLang(lang);
  const tgt = targetLang(lang);
  const isForward = !CYRILLIC_RE.test(query) || src !== 'ru';
  if (isForward && !skipCache) {
    const existing = await findInDb(query);
    if (existing) return { ...existing, lang };
  }

  // Запрос к Yandex Dictionary API
  const url = `${YANDEX_API_URL}?key=${encodeURIComponent(apiKey)}&lang=${lang}&text=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Yandex Dictionary API error: ${response.status}`);
  }

  let data = (await response.json()) as YandexDictionaryResponse;
  let usedLemma: string | null = null;

  // Если не нашли — пробуем лемматизированные формы (только для английских слов)
  if (data.def.length === 0 && isForward) {
    const forms = lemmatize(query);
    for (let i = 1; i < forms.length; i++) {
      const form = forms[i];
      if (form === query) continue;

      const lemmaUrl = `${YANDEX_API_URL}?key=${encodeURIComponent(apiKey)}&lang=${lang}&text=${encodeURIComponent(form)}`;
      const lemmaResponse = await fetch(lemmaUrl);
      if (!lemmaResponse.ok) continue;

      const lemmaData = (await lemmaResponse.json()) as YandexDictionaryResponse;
      if (lemmaData.def.length > 0) {
        data = lemmaData;
        usedLemma = form;
        break;
      }
    }
  }

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

      const meaningHints = (tr.mean ?? []).map((m) => m.text);

      meanings.push({
        id: null,
        translation: tr.text,
        partOfSpeech: pos,
        translationPartOfSpeech: tr.pos ?? null,
        frequency: tr.fr ?? null,
        meaningHints,
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
      ? await saveToDb(query, meanings, src, tgt, transcription, usedLemma)
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
    transcription: word.transcription,
    meanings: word.meanings.map((m) => ({
      id: m.id,
      translation: m.translation,
      partOfSpeech: m.partOfSpeech,
      translationPartOfSpeech: m.translationPartOfSpeech,
      frequency: m.frequency,
      meaningHints: m.meaningHints ?? [],
      examples: m.examples ?? (m.contextExample ? [{ text: m.contextExample, translation: '' }] : []),
      synonyms: m.synonyms ?? [],
    })),
    savedToDb: false,
  };
}

async function saveToDb(text: string, meanings: MeaningResult[], wordLang: string, translationLang: string, transcription: string | null = null, lemma: string | null = null): Promise<MeaningResult[]> {
  let [word] = await db
    .select()
    .from(words)
    .where(eq(words.text, text))
    .limit(1);

  if (!word) {
    [word] = await db
      .insert(words)
      .values({ text, language: wordLang, transcription, lemma })
      .returning();
  } else {
    // Обновляем транскрипцию и лемму если их не было
    const updates: Record<string, string> = {};
    if (transcription && !word.transcription) {
      updates.transcription = transcription;
    }
    if (lemma && !word.lemma) {
      updates.lemma = lemma;
    }
    if (Object.keys(updates).length > 0) {
      await db.update(words).set(updates).where(eq(words.id, word.id));
    }
  }

  const result: MeaningResult[] = [];

  // Фильтруем переводы: для русского языка требуем кириллицу
  const validMeanings = translationLang === 'ru'
    ? meanings.filter(m => CYRILLIC_RE.test(m.translation))
    : meanings;

  for (const meaning of validMeanings) {
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
        translationPartOfSpeech: meaning.translationPartOfSpeech,
        contextExample: meaning.examples[0]?.text ?? null,
        difficulty: 'medium',
        frequency: meaning.frequency,
        meaningHints: meaning.meaningHints.length > 0 ? meaning.meaningHints : null,
        synonyms: meaning.synonyms.length > 0 ? meaning.synonyms : null,
        examples: meaning.examples.length > 0 ? meaning.examples : null,
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

      const meaningHints = (tr.mean ?? []).map((m) => m.text);

      if (existing.length > 0) {
        result.push({
          id: existing[0]!.id,
          translation: tr.text,
          partOfSpeech: pos,
          translationPartOfSpeech: tr.pos ?? null,
          frequency: tr.fr ?? null,
          meaningHints,
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
          translationPartOfSpeech: tr.pos ?? null,
          contextExample: examples[0]?.text ?? null,
          difficulty: 'medium',
          frequency: tr.fr ?? null,
          meaningHints: meaningHints.length > 0 ? meaningHints : null,
          synonyms: synonyms.length > 0 ? synonyms : null,
          examples: examples.length > 0 ? examples : null,
        })
        .returning();

      result.push({
        id: inserted!.id,
        translation: tr.text,
        partOfSpeech: pos,
        translationPartOfSpeech: tr.pos ?? null,
        frequency: tr.fr ?? null,
        meaningHints,
        examples,
        synonyms,
      });
    }
  }

  return result;
}
