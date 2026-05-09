import type { PooledMeaning, FreeRecallQuestion } from '../types.js';
import { getAllTranslations } from './multiple-choice.js';
import { loadWordMeaningsList } from './word-meanings-list.js';
import { getWordForms } from '../../word-forms-service.js';

// ─── Generation ──────────────────────────────────────────────────────────────

/**
 * Проверяет, подходит ли meaning для free-recall вопроса.
 * В идеале требует srsStage >= 2 (частично выученное слово),
 * но PooledMeaning не содержит srsStage — фильтрация выполняется
 * в quiz-service при формировании пула.
 */
export function canGenerateFreeRecall(_meaning: PooledMeaning): boolean {
  return true;
}

/**
 * Генерирует free-recall вопрос из meaning.
 * Направление по умолчанию случайное 50/50; вызывающий код может зафиксировать
 * направление через opts.direction (используется в learning-flow, где формат
 * единственный — ru→en).
 *
 * Word-level (opts.includeMeanings=true): подгружает топ-3 значений слова
 * → клиент рендерит все русские переводы списком как стимул L3 active recall.
 * Meaning-level rollback: meanings не подгружается, prompt = одно значение.
 */
export async function generateFreeRecallFromMeaning(
  correct: PooledMeaning,
  opts?: { direction?: 'en-ru' | 'ru-en'; includeMeanings?: boolean },
): Promise<FreeRecallQuestion> {
  const direction = opts?.direction ?? (Math.random() < 0.5 ? 'en-ru' : 'ru-en');
  const englishWord = correct.word.lemma ?? correct.word.text;

  // Подгружаем список ВСЕХ eligible значений для word-level (L3 active).
  // Без лимита: синхронизация с L0/L4, юзер видит все meanings слова как
  // стимул при ru→en вводе.
  const meanings = opts?.includeMeanings
    ? await loadWordMeaningsList(correct.wordId)
    : undefined;

  // Грамматические формы слова — только для word-level (L3 active).
  const forms = opts?.includeMeanings
    ? getWordForms(correct.word.text, correct.partOfSpeech)
    : null;

  if (direction === 'en-ru') {
    // Показываем английское слово → пользователь пишет перевод
    const allTranslations = getAllTranslations(correct);
    const synonyms = correct.synonyms ?? [];
    const acceptableAnswers = [...new Set([...allTranslations, ...synonyms])];

    return {
      type: 'free-recall',
      meaningId: correct.id,
      wordId: correct.wordId,
      direction: 'en-ru',
      prompt: englishWord,
      transcription: correct.word.transcription,
      audioWord: englishWord,
      acceptableAnswers,
      partOfSpeech: correct.partOfSpeech,
      meanings,
      forms,
    };
  } else {
    // Показываем русский перевод → пользователь пишет английское слово
    const acceptableAnswers = [
      correct.word.text,
      ...(correct.word.lemma ? [correct.word.lemma] : []),
    ].filter(Boolean);

    // Дедупликация (text и lemma могут совпадать)
    const unique = [...new Set(acceptableAnswers)];

    return {
      type: 'free-recall',
      meaningId: correct.id,
      wordId: correct.wordId,
      direction: 'ru-en',
      prompt: correct.translation,
      transcription: null,
      audioWord: englishWord,
      acceptableAnswers: unique,
      partOfSpeech: correct.partOfSpeech,
      meanings,
      forms,
    };
  }
}
