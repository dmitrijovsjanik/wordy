import type { PooledMeaning, PoolCardQuestion } from '../types.js';
import { getAiExamples } from '../../ai-content-service.js';
import { loadWordMeaningsList } from './word-meanings-list.js';
import { getWordForms } from '../../word-forms-service.js';

/**
 * Генерирует pool-карточку для L0 v2: слово + переводы + 3 кнопки в футере
 * на клиенте (Знаю / Изучаю / Отложить).
 *
 * Чистый word-level: meaningId — representative (для совместимости с
 * legacy событиями), wordId — основной идентификатор для applyPoolSwipe.
 */
export async function generatePoolCard(meaning: PooledMeaning): Promise<PoolCardQuestion> {
  // AI-example > Yandex-example fallback (для UI карточки).
  let example: { en: string; ru: string } | null = null;
  const aiExamples = await getAiExamples(meaning.id);
  if (aiExamples && aiExamples.sentences.length > 0) {
    const s = aiExamples.sentences[0]!;
    example = { en: s.en, ru: s.ru };
  } else if (meaning.examples && meaning.examples.length > 0) {
    const ex = meaning.examples[0]!;
    example = { en: ex.text, ru: ex.translation };
  }

  const meanings = await loadWordMeaningsList(meaning.wordId);
  const forms = getWordForms(meaning.word.text, meaning.partOfSpeech);

  return {
    type: 'pool-card',
    wordId: meaning.wordId,
    meaningId: meaning.id,
    word: meaning.word.text,
    transcription: meaning.word.transcription,
    partOfSpeech: meaning.partOfSpeech,
    meanings,
    forms,
    example,
  };
}
