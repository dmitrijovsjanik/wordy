import { getAiMnemonic, getAiExamples } from '../../ai-content-service.js';
import type { PooledMeaning, EncounterCardQuestion } from '../types.js';

/**
 * Генерирует encounter-карточку для первого знакомства со словом.
 * Без проверки: только показ слова + перевод + AI-контекст (если есть).
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

  return {
    type: 'encounter',
    meaningId: meaning.id,
    word: meaning.word.text,
    originalForm: null,
    translation: meaning.translation,
    transcription: meaning.word.transcription,
    mnemonic,
    example,
    partOfSpeech: meaning.partOfSpeech,
    direction: 'en-ru',
  };
}
