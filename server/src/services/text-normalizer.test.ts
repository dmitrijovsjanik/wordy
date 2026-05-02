import { describe, it, expect } from 'vitest';
import { normalizeAndCompare } from './text-normalizer.js';

describe('normalizeAndCompare', () => {
  it('exact: identical input', () => {
    const r = normalizeAndCompare('shoe', 'shoe');
    expect(r.match).toBe(true);
    expect(r.via).toBe('exact');
  });

  it('exact: case + punctuation are normalized', () => {
    const r = normalizeAndCompare('Shoe!', 'shoe');
    expect(r.match).toBe(true);
    expect(r.via).toBe('exact');
  });

  it('lemma: plural noun → singular (shoes vs shoe, pos=noun)', () => {
    const r = normalizeAndCompare('shoes', 'shoe', { partOfSpeech: 'noun' });
    expect(r.match).toBe(true);
    expect(r.via).toBe('lemma');
  });

  it('lemma: irregular verb past → infinitive (ran vs run, pos=verb)', () => {
    const r = normalizeAndCompare('ran', 'run', { partOfSpeech: 'verb' });
    expect(r.match).toBe(true);
    expect(r.via).toBe('lemma');
  });

  it('typo: single-character substitution (shoo vs shoe)', () => {
    const r = normalizeAndCompare('shoo', 'shoe');
    expect(r.match).toBe(true);
    expect(r.via).toBe('typo');
    expect(r.correctedTo).toBe('shoe');
  });

  it('no match: unrelated words', () => {
    const r = normalizeAndCompare('boot', 'shoe');
    expect(r.match).toBe(false);
    expect(r.via).toBe('none');
  });

  it('typo: rejected for short words (a vs ab, len < 4)', () => {
    const r = normalizeAndCompare('a', 'ab');
    expect(r.match).toBe(false);
    expect(r.via).toBe('none');
  });

  it('exact: array of accepted answers', () => {
    const r = normalizeAndCompare('shoe', ['sneaker', 'shoe']);
    expect(r.match).toBe(true);
    expect(r.via).toBe('exact');
  });

  it('phrase: identical phrase', () => {
    const r = normalizeAndCompare('give up', 'give up');
    expect(r.match).toBe(true);
    expect(r.via).toBe('exact');
  });

  it('phrase: case + punctuation normalize', () => {
    const r = normalizeAndCompare('give Up!', 'give up');
    expect(r.match).toBe(true);
    expect(r.via).toBe('exact');
  });

  it('phrase: no lemma fallback for pos=phrase (gave up vs give up)', () => {
    // Phrases are not lemmatized — wink-lemmatizer is single-token only and
    // we deliberately skip lemma fallback for multi-word entries. This means
    // "gave up" → "give up" is NOT auto-accepted; the quiz layer should treat
    // it as wrong (the user must produce the dictionary form).
    const r = normalizeAndCompare('gave up', 'give up', { partOfSpeech: 'phrase' });
    expect(r.match).toBe(false);
    expect(r.via).toBe('none');
  });

  it('empty input: never matches', () => {
    const r = normalizeAndCompare('', 'shoe');
    expect(r.match).toBe(false);
    expect(r.via).toBe('none');
  });

  // ─── Bonus coverage: edge cases worth pinning down ─────────────────────────

  it('typo: phrase with single-character typo in one token (no pos hint)', () => {
    // Expected token "give" is 4 chars → typo allowed there.
    // "give ip" — token "ip" vs "up" is too short (len < 4) for typo path.
    const r = normalizeAndCompare('give ip', 'give up');
    expect(r.match).toBe(false);
    // "givo up" — single-char substitution in "give" (Levenshtein 1).
    const r2 = normalizeAndCompare('givo up', 'give up');
    expect(r2.match).toBe(true);
    expect(r2.via).toBe('typo');
  });

  it('lemma: comparative adjective (better vs good, pos=adj)', () => {
    const r = normalizeAndCompare('better', 'good', { partOfSpeech: 'adj' });
    expect(r.match).toBe(true);
    expect(r.via).toBe('lemma');
  });

  it('no lemma path without partOfSpeech option', () => {
    // Without pos hint, "shoes" vs "shoe" must NOT lemma-match — it would
    // only succeed via typo (distance 1 → yes, both ≥ 4).
    const r = normalizeAndCompare('shoes', 'shoe');
    expect(r.match).toBe(true);
    // "shoes" vs "shoe" is Levenshtein 1 — expected ≥ 4 chars satisfied.
    expect(r.via).toBe('typo');
  });
});
