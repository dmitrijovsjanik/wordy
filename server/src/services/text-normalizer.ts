// Text normalizer for active recall.
//
// Compares user input against an expected answer (or list of accepted answers)
// using a layered strategy:
//   1. Punctuation/case-insensitive exact match.
//   2. Lemma equality (only for noun/verb/adj — adv & phrase have no
//      single-word lemmatizer support in wink).
//   3. Levenshtein-1 typo tolerance (single token, length ≥ 4).
//
// This service is a leaf — no DB, no I/O. Easy to unit-test.

// wink-lemmatizer ships no .d.ts; minimal inline typing.
import lemmatizer from 'wink-lemmatizer';

type WinkLemmatizer = {
  noun: (w: string) => string;
  verb: (w: string) => string;
  adjective: (w: string) => string;
};
const lemma = lemmatizer as unknown as WinkLemmatizer;

export type NormalizerPos = 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';

export interface NormalizeOptions {
  partOfSpeech?: NormalizerPos;
}

export type NormalizeVia = 'exact' | 'lemma' | 'typo' | 'none';

export interface NormalizeResult {
  match: boolean;
  via: NormalizeVia;
  correctedTo?: string;
}

const PUNCT_RE = /[,.!?;:'"]/g;

function normalize(text: string): string {
  return text.replace(PUNCT_RE, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function lemmatizeWord(word: string, pos: NormalizerPos): string {
  switch (pos) {
    case 'noun':
      return safe(lemma.noun, word);
    case 'verb':
      return safe(lemma.verb, word);
    case 'adj':
      return safe(lemma.adjective, word);
    default:
      return word;
  }
}

function safe(fn: (w: string) => string, w: string): string {
  try {
    const out = fn(w);
    return typeof out === 'string' && out.length > 0 ? out : w;
  } catch {
    return w;
  }
}

// Classic Levenshtein. Iterative, two-row DP. Bails early once a row's
// minimum exceeds `maxDistance`.
function levenshtein(a: string, b: string, maxDistance: number): number {
  if (a === b) return 0;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > maxDistance) return maxDistance + 1;
  if (la === 0) return lb;
  if (lb === 0) return la;

  let prev = new Array<number>(lb + 1);
  let curr = new Array<number>(lb + 1);
  for (let j = 0; j <= lb; j++) prev[j] = j;

  for (let i = 1; i <= la; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const v = Math.min(
        curr[j - 1] + 1, // insert
        prev[j] + 1, // delete
        prev[j - 1] + cost, // substitute
      );
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDistance) return maxDistance + 1;
    [prev, curr] = [curr, prev];
  }
  return prev[lb];
}

function isMultiToken(s: string): boolean {
  return s.includes(' ');
}

/**
 * Compare a user-typed `input` with one or more `expected` answers.
 *
 * Order of attempts:
 *   1. exact (after normalize)
 *   2. lemma (only when `partOfSpeech` is noun/verb/adj AND both inputs
 *      are single tokens)
 *   3. typo — Levenshtein distance ≤ 1, but only:
 *        - for single-word expected: input length ≥ 4
 *        - for multi-word expected: token-count must match; each pair
 *          either equal OR (length ≥ 4 AND distance ≤ 1); total typos
 *          across the whole string ≤ 1
 *   4. otherwise — no match
 */
export function normalizeAndCompare(
  input: string,
  expected: string | string[],
  opts: NormalizeOptions = {},
): NormalizeResult {
  const normInput = normalize(input);
  if (!normInput) return { match: false, via: 'none' };

  const expectedList = (Array.isArray(expected) ? expected : [expected])
    .map(normalize)
    .filter((s) => s.length > 0);
  if (expectedList.length === 0) return { match: false, via: 'none' };

  // 1. Exact.
  if (expectedList.includes(normInput)) {
    return { match: true, via: 'exact' };
  }

  // 2. Lemma (single-word, lemmatizable POS only).
  const pos = opts.partOfSpeech;
  const lemmatizable = pos === 'noun' || pos === 'verb' || pos === 'adj';
  if (lemmatizable && !isMultiToken(normInput)) {
    const inputLemma = lemmatizeWord(normInput, pos);
    for (const exp of expectedList) {
      if (isMultiToken(exp)) continue;
      const expLemma = lemmatizeWord(exp, pos);
      if (inputLemma === expLemma) {
        return { match: true, via: 'lemma', correctedTo: exp };
      }
    }
  }

  // 3. Typo tolerance (Levenshtein ≤ 1).
  //
  // Special-case: when pos='phrase' is explicitly set, we treat the answer
  // as a memorization test — typo tolerance across tokens would also let
  // through morphological inflections (e.g. "gave"/"give" is Lev=1), which
  // we want to flag as wrong. So skip typo entirely for explicit phrase pos.
  if (pos === 'phrase') {
    return { match: false, via: 'none' };
  }
  for (const exp of expectedList) {
    if (isMultiToken(exp)) {
      // Phrase: token-by-token, total edits ≤ 1.
      const inputTokens = normInput.split(' ');
      const expTokens = exp.split(' ');
      if (inputTokens.length !== expTokens.length) continue;
      let totalEdits = 0;
      let ok = true;
      for (let i = 0; i < inputTokens.length; i++) {
        const a = inputTokens[i];
        const b = expTokens[i];
        if (a === b) continue;
        // Per-token typo only allowed if the EXPECTED token is length ≥ 4.
        if (b.length < 4) {
          ok = false;
          break;
        }
        const d = levenshtein(a, b, 1);
        if (d > 1) {
          ok = false;
          break;
        }
        totalEdits += d;
        if (totalEdits > 1) {
          ok = false;
          break;
        }
      }
      if (ok && totalEdits >= 1 && totalEdits <= 1) {
        return { match: true, via: 'typo', correctedTo: exp };
      }
    } else {
      if (isMultiToken(normInput)) continue;
      // Single word: minimum length 4 on the EXPECTED side.
      if (exp.length < 4) continue;
      const d = levenshtein(normInput, exp, 1);
      if (d === 1) {
        return { match: true, via: 'typo', correctedTo: exp };
      }
    }
  }

  return { match: false, via: 'none' };
}
