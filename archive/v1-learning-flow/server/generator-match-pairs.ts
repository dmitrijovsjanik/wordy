import { inArray, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { wordMeanings } from '../../../db/schema.js';
import type { PooledMeaning, MatchPairsQuestion, CustomWordForQuiz } from '../types.js';

const TARGET_PAIRS = 3;
const MIN_PAIRS = 3;

/**
 * Генерирует вопрос match-pairs из пула пользователя.
 * Берёт до 5 уникальных пар (слово + перевод) из meaningIds и customWords.
 * Возвращает null если пар меньше MIN_PAIRS.
 */
export async function generateMatchPairsFromPool(
  meaningIds: number[],
  customWords: CustomWordForQuiz[],
): Promise<MatchPairsQuestion | null> {
  const pairs: Array<{ meaningId: number; word: string; translation: string }> = [];
  const usedWords = new Set<string>();
  const usedTranslations = new Set<string>();

  // Системные слова из пула
  if (meaningIds.length > 0) {
    const candidates = await db.query.wordMeanings.findMany({
      where: inArray(wordMeanings.id, meaningIds),
      with: { word: true },
      orderBy: sql`RANDOM()`,
      limit: TARGET_PAIRS * 3, // берём с запасом для дедупликации
    });

    for (const candidate of candidates) {
      if (pairs.length >= TARGET_PAIRS) break;

      const m = candidate as PooledMeaning;

      // Фильтры качества (аналог multiple-choice)
      if (m.word.lemma === null && !m.word.text) continue;
      const word = m.word.lemma ?? m.word.text;
      const translation = m.translation;

      // Дедупликация
      const wordLower = word.toLowerCase();
      const translationLower = translation.toLowerCase();
      if (usedWords.has(wordLower) || usedTranslations.has(translationLower)) continue;

      // Фильтр кириллицы (перевод должен содержать кириллицу)
      if (!/[а-яА-ЯёЁ]/.test(translation)) continue;

      usedWords.add(wordLower);
      usedTranslations.add(translationLower);
      pairs.push({ meaningId: m.id, word, translation });
    }
  }

  // Кастомные слова
  if (pairs.length < TARGET_PAIRS && customWords.length > 0) {
    // Перемешиваем кастомные слова
    const shuffled = [...customWords].sort(() => Math.random() - 0.5);

    for (const cw of shuffled) {
      if (pairs.length >= TARGET_PAIRS) break;

      const wordLower = cw.wordText.toLowerCase();
      const translationLower = cw.translation.toLowerCase();
      if (usedWords.has(wordLower) || usedTranslations.has(translationLower)) continue;

      usedWords.add(wordLower);
      usedTranslations.add(translationLower);
      pairs.push({ meaningId: -cw.id, word: cw.wordText, translation: cw.translation });
    }
  }

  if (pairs.length < MIN_PAIRS) return null;

  return { type: 'match-pairs', pairs };
}
