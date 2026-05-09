/**
 * Word Forms Service
 *
 * Возвращает грамматические формы английского слова + лейблы форм для UI.
 * Используется в карточках обучения L1-L3 (encounter, passive-recall, free-recall):
 *   - под словом показываем список форм с лейблами,
 *   - в примерах подсвечиваем формы и показываем их роль во всплывашке.
 *
 * Источники:
 *   1. STATIC overrides (`word-forms-static.ts`) — модальные/вспомогательные глаголы,
 *      местоимения, артикли. NLP-библиотеки на этих словах ломаются.
 *   2. `compromise` — спрягает глаголы (past, gerund, 3rd-person), сравнивает
 *      прилагательные (toComparative/toSuperlative).
 *   3. `pluralize` — формирует множественное число существительных (и
 *      определяет, является ли слово уже множественным).
 *
 * Кэш: in-memory LRU на 5000 записей. Формы стабильны, TTL не нужен.
 */
import nlp from 'compromise';
import pluralize from 'pluralize';
import { getStaticForms } from '../data/word-forms-static.js';

export type WordFormPos = 'verb' | 'noun' | 'adjective' | 'modal' | 'pronoun' | 'other';

export type WordForm = {
  text: string;
  label: string;
};

export type WordForms = {
  base: string;
  partOfSpeech: WordFormPos;
  forms: WordForm[];
};

// ─── LRU cache ──────────────────────────────────────────────────────────────

class LRU<K, V> {
  private map = new Map<K, V>();
  constructor(private maxSize: number) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    if (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
}

const CACHE_SIZE = 5000;
const cache = new LRU<string, WordForms>(CACHE_SIZE);

// ─── POS hint mapping ──────────────────────────────────────────────────────

type DbPos = 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';

function dbPosToInternal(pos: DbPos | null | undefined): WordFormPos | null {
  if (pos === 'verb') return 'verb';
  if (pos === 'noun') return 'noun';
  if (pos === 'adj') return 'adjective';
  return null;
}

// ─── Builders ───────────────────────────────────────────────────────────────

type Conjugation = {
  Infinitive?: string;
  PresentTense?: string;
  PastTense?: string;
  Gerund?: string;
  Participle?: string;
  PerfectTense?: string;
};

function buildVerbForms(word: string): WordForms | null {
  const doc = nlp(word).verbs();
  const conj = doc.conjugate()[0] as Conjugation | undefined;
  if (!conj) return null;

  const base = conj.Infinitive ?? word;
  const seen = new Set<string>();
  const forms: WordForm[] = [];
  const push = (text: string | undefined, label: string) => {
    if (!text) return;
    const t = text.trim();
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    forms.push({ text: t, label });
  };

  push(conj.Infinitive, 'инфинитив');
  push(conj.PresentTense, '3 лицо ед.ч., наст.');
  push(conj.PastTense, 'прошедшее время');
  push(conj.Gerund, 'герундий / -ing форма');
  // В старых версиях compromise — PerfectTense; в новых — Participle.
  push(conj.Participle ?? conj.PerfectTense, 'причастие прошедшее');

  if (forms.length === 0) return null;
  return { base, partOfSpeech: 'verb', forms };
}

function buildNounForms(word: string): WordForms | null {
  const lower = word.toLowerCase();
  const isPlural = pluralize.isPlural(lower);
  const singular = pluralize.singular(lower);
  const plural = pluralize.plural(singular);

  const forms: WordForm[] = [];
  forms.push({ text: singular, label: 'ед.ч.' });
  if (plural !== singular) {
    forms.push({ text: plural, label: 'мн.ч.' });
  }

  // Иногда pluralize считает слово плюральным, но singular === plural (sheep, fish).
  if (isPlural && singular === plural) {
    return {
      base: singular,
      partOfSpeech: 'noun',
      forms: [{ text: singular, label: 'ед./мн.ч. (без изменения)' }],
    };
  }

  return { base: singular, partOfSpeech: 'noun', forms };
}

function buildAdjectiveForms(word: string): WordForms | null {
  const doc = nlp(word);
  const adjs = doc.adjectives();
  if (adjs.length === 0) return null;

  const positive = word.toLowerCase();
  const comparative = adjs.toComparative().out('text').trim();
  const superlative = adjs.toSuperlative().out('text').trim();

  const forms: WordForm[] = [{ text: positive, label: 'положительная степень' }];
  if (comparative && comparative.toLowerCase() !== positive) {
    forms.push({ text: comparative, label: 'сравнительная степень' });
  }
  if (superlative && superlative.toLowerCase() !== positive) {
    forms.push({ text: superlative, label: 'превосходная степень' });
  }

  if (forms.length === 1) return null;
  return { base: positive, partOfSpeech: 'adjective', forms };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Возвращает формы английского слова. POS-хинт помогает выбрать правильную
 * стратегию (compromise может неправильно классифицировать многозначные слова
 * вроде «work» — это и глагол, и существительное).
 *
 * Возвращает `null` если форм нет (например, слово — наречие, междометие, или
 * compromise не смог спрягать). На клиенте это значит «список форм не
 * показываем».
 */
export function getWordForms(word: string, posHint?: DbPos | null): WordForms | null {
  const key = `${posHint ?? 'auto'}:${word.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const result = computeWordForms(word, posHint);
  if (result) cache.set(key, result);
  return result;
}

function computeWordForms(word: string, posHint?: DbPos | null): WordForms | null {
  // 1. Static overrides — модалы/местоимения/артикли.
  const stat = getStaticForms(word);
  if (stat) return stat;

  // 2. По POS-хинту — стратегия.
  const pos = dbPosToInternal(posHint);
  if (pos === 'verb') return buildVerbForms(word);
  if (pos === 'noun') return buildNounForms(word);
  if (pos === 'adjective') return buildAdjectiveForms(word);

  // 3. Авто-режим: пробуем определить через compromise.
  const doc = nlp(word);
  if (doc.verbs().length > 0) {
    const v = buildVerbForms(word);
    if (v) return v;
  }
  if (doc.adjectives().length > 0) {
    const a = buildAdjectiveForms(word);
    if (a) return a;
  }
  if (doc.nouns().length > 0) {
    return buildNounForms(word);
  }

  // 4. Ничего не вышло — наречие/прочее. Возвращаем null.
  return null;
}
