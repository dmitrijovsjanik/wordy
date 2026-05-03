/**
 * Загружает топ-N значений слова для word-level карточек (L1-3).
 *
 * Применяемые фильтры (как и в introduceUnseenWord/pickRepresentativeMeaning):
 *   - popularity_rank ≤ 3
 *   - frequency ≥ 5
 *   - кириллический перевод
 *   - не functional POS / не functional english word
 *
 * Сортировка по popularity_rank ASC. Если у слова больше N eligible meanings,
 * берётся top-N. Если меньше — возвращается реальное количество (без паддинга).
 *
 * Для каждого meaning'а подмешивается AI-example > Yandex-example fallback.
 */

import { sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import type { WordMeaningInfo } from '../types.js';

const TOP_N = 3;

type Row = {
  meaning_id: number;
  translation: string;
  part_of_speech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  ai_examples: { sentences?: { en: string; ru: string }[] } | null;
  yandex_examples: { text: string; translation: string }[] | null;
};

export async function loadWordMeaningsList(wordId: number, limit: number = TOP_N): Promise<WordMeaningInfo[]> {
  const result = await db.execute(sql`
    SELECT
      wm.id AS meaning_id,
      wm.translation,
      wm.part_of_speech,
      ai.content AS ai_examples,
      wm.examples AS yandex_examples
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    LEFT JOIN word_ai_content ai
      ON ai.meaning_id = wm.id AND ai.content_type = 'examples'
    WHERE wm.word_id = ${wordId}
      AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
      AND (
        wm.translation_part_of_speech IS NULL
        OR wm.translation_part_of_speech NOT IN (
          'preposition', 'conjunction', 'particle', 'interjection',
          'parenthetic', 'invariable', 'adverbial participle'
        )
      )
      AND w.text NOT IN ('a', 'an', 'the')
    ORDER BY wm.popularity_rank NULLS LAST, wm.id
    LIMIT ${limit}
  `);

  const rows = (result as unknown as { rows: Row[] }).rows;
  return rows.map((r): WordMeaningInfo => {
    let example: { en: string; ru: string } | null = null;
    if (r.ai_examples?.sentences && r.ai_examples.sentences.length > 0) {
      const s = r.ai_examples.sentences[0]!;
      example = { en: s.en, ru: s.ru };
    } else if (r.yandex_examples && r.yandex_examples.length > 0) {
      const ex = r.yandex_examples[0]!;
      example = { en: ex.text, ru: ex.translation };
    }
    return {
      meaningId: Number(r.meaning_id),
      translation: r.translation,
      example,
      partOfSpeech: r.part_of_speech,
    };
  });
}
