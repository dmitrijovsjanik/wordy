import { eq, asc } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { wordMeanings } from '../../../db/schema.js';
import { getAiExamples, getAiMnemonic } from '../../ai-content-service.js';
import type { PooledMeaning, PassiveRecallCardQuestion } from '../types.js';
import { loadWordMeaningsList } from './word-meanings-list.js';
import { getWordForms } from '../../word-forms-service.js';

/**
 * Генерирует passive-recall карточку — флешкарту с флипом для самооценки.
 *
 * meaningIndex/totalMeanings считаются по всем значениям слова в порядке
 * popularity_rank (тот же порядок, что используется в коллекциях/dictionary).
 * Для слова с одним значением totalMeanings=1, клиент сам решит скрывать ли
 * индикатор «1 из 1».
 */
export async function generatePassiveRecallFromMeaning(
  meaning: PooledMeaning,
): Promise<PassiveRecallCardQuestion | null> {
  const allMeanings = await db
    .select({ id: wordMeanings.id })
    .from(wordMeanings)
    .where(eq(wordMeanings.wordId, meaning.wordId))
    .orderBy(asc(wordMeanings.popularityRank));

  const idx = allMeanings.findIndex(m => m.id === meaning.id);
  if (idx === -1) return null;

  // AI-example > Yandex-example fallback (как в encounter).
  let example: { en: string; ru: string } | null = null;
  const aiExamples = await getAiExamples(meaning.id);
  if (aiExamples && aiExamples.sentences.length > 0) {
    const s = aiExamples.sentences[0]!;
    example = { en: s.en, ru: s.ru };
  } else if (meaning.examples && meaning.examples.length > 0) {
    const ex = meaning.examples[0]!;
    example = { en: ex.text, ru: ex.translation };
  }

  const aiMnemonic = await getAiMnemonic(meaning.id);
  const mnemonic = aiMnemonic?.association ?? null;

  // Все eligible значения слова — для рендера на обратной стороне карточки.
  // (passive скрыт в пилоте через migrate-on-touch, но если генератор всё-таки
  // позовётся для legacy-записи — синхронизируемся с остальными уровнями.)
  const meaningsList = await loadWordMeaningsList(meaning.wordId);

  // Грамматические формы слова.
  const forms = getWordForms(meaning.word.text, meaning.partOfSpeech);

  return {
    type: 'passive-recall',
    meaningId: meaning.id,
    wordId: meaning.wordId,
    word: meaning.word.text,
    translation: meaning.translation,
    example,
    mnemonic,
    meaningIndex: idx + 1,
    totalMeanings: allMeanings.length,
    meanings: meaningsList,
    forms,
  };
}
