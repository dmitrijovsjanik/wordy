import { eq, asc } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { wordMeanings } from '../../../db/schema.js';
import { getAiMnemonic, getAiExamples } from '../../ai-content-service.js';
import type { PooledMeaning, EncounterCardQuestion } from '../types.js';
import { loadWordMeaningsList } from './word-meanings-list.js';

/**
 * Генерирует encounter-карточку для первого знакомства со словом.
 * Без проверки: только показ слова + перевод + AI-контекст (если есть).
 *
 * meaningIndex/totalMeanings рассчитываются по всем значениям слова в порядке
 * popularity_rank (тот же порядок что в passive-recall) — нужны для
 * консистентного UI флешкарты «N/M».
 */
export async function generateEncounterCard(meaning: PooledMeaning): Promise<EncounterCardQuestion> {
  // AI-mnemonic (если есть в word_ai_content)
  const aiMnemonic = await getAiMnemonic(meaning.id);
  const mnemonic = aiMnemonic?.association ?? null;

  // AI-example > Yandex-example fallback
  let example: { en: string; ru: string } | null = null;
  const aiExamples = await getAiExamples(meaning.id);
  if (aiExamples && aiExamples.sentences.length > 0) {
    const s = aiExamples.sentences[0]!;
    example = { en: s.en, ru: s.ru };
  } else if (meaning.examples && meaning.examples.length > 0) {
    const ex = meaning.examples[0]!;
    example = { en: ex.text, ru: ex.translation };
  }

  // Позиция значения среди всех значений слова (popularity_rank order).
  const allMeanings = await db
    .select({ id: wordMeanings.id })
    .from(wordMeanings)
    .where(eq(wordMeanings.wordId, meaning.wordId))
    .orderBy(asc(wordMeanings.popularityRank));
  const idx = allMeanings.findIndex(m => m.id === meaning.id);
  const meaningIndex = idx === -1 ? 1 : idx + 1;
  const totalMeanings = allMeanings.length;

  // Список топ-3 значений слова — для word-level UI на L1.
  const meanings = await loadWordMeaningsList(meaning.wordId, 3);

  return {
    type: 'encounter',
    meaningId: meaning.id,
    wordId: meaning.wordId,
    word: meaning.word.text,
    originalForm: null,
    translation: meaning.translation,
    transcription: meaning.word.transcription,
    mnemonic,
    example,
    partOfSpeech: meaning.partOfSpeech,
    direction: 'en-ru',
    meaningIndex,
    totalMeanings,
    meanings,
  };
}
