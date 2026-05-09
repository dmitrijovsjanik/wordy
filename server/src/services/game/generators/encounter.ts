import { getAiMnemonic, getAiExamples } from '../../ai-content-service.js';
import type { PooledMeaning, EncounterCardQuestion } from '../types.js';
import { loadWordMeaningsList } from './word-meanings-list.js';
import { getWordForms } from '../../word-forms-service.js';

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

  // Все eligible значения слова — для word-level UI на L1.
  // Без лимита: на L0 (обзор) и L4 (production) показываются все meanings,
  // L1/L3 синхронизированы с ними.
  const meanings = await loadWordMeaningsList(meaning.wordId);

  // meaningIndex/totalMeanings рассчитываются по eligible-набору (тому же,
  // что показывается юзеру в meanings), не по всем meanings таблицы. Иначе
  // UI «N из M» рассинхронизирован с реально показанным списком.
  const idx = meanings.findIndex(m => m.meaningId === meaning.id);
  const meaningIndex = idx === -1 ? 1 : idx + 1;
  const totalMeanings = meanings.length;

  // Грамматические формы слова — список + лейблы для подсветки в примерах.
  const forms = getWordForms(meaning.word.text, meaning.partOfSpeech);

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
    forms,
  };
}
