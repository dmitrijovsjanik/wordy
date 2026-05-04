/**
 * Review Feed Service — отбор слов для режима обзора (этап 3).
 *
 * Один режим: карточка = слово + все его eligible meanings. Решение
 * (свайп) применяется к слову целиком — поэтому показываем все смыслы
 * сразу, не разбиваем на стопку. См. этап 3 рефакторинга.
 *
 * Логика отбора:
 *   - Слова, у которых есть хотя бы одно eligible meaning (popularity_rank ≤ 3,
 *     frequency ≥ 5, кириллический перевод, non-functional POS).
 *   - На которые пользователь ещё не сделал явный выбор: либо нет записи в
 *     user_word_progress, либо state='snoozed' с истёкшим snoozed_until.
 *   - Уровень CEFR: совпадает с user.estimated_cefr ± 1.
 *   - Сортировка: по frequency_rank слова (более частотные впереди), RANDOM().
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { NON_FUNCTIONAL_SQL } from '../db/word-filters.js';

/** Один смысл слова в обзоре. exampleEn/exampleRu заполняются только у первого
 *  meaning по popularity_rank ASC — UI показывает один пример на карточку. */
export type ReviewFeedMeaning = {
  meaningId: number;
  translation: string;
  exampleEn?: string;
  exampleRu?: string;
};

/** Слово в обзорном фиде. partOfSpeech — POS первого meaning по
 *  popularity_rank ASC (одно слово в одной POS-роли в карточке). */
export type ReviewFeedWord = {
  wordId: number;
  text: string;
  transcription: string | null;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  meanings: ReviewFeedMeaning[];
};

const CEFR_ORDER = ['a1', 'a2', 'b1', 'b2', 'c1'] as const;

function getCefrRange(userCefr: string | null): string[] {
  if (!userCefr) return ['a1', 'a2'];
  const idx = CEFR_ORDER.indexOf(userCefr.toLowerCase() as typeof CEFR_ORDER[number]);
  if (idx < 0) return ['a1', 'a2'];
  const from = Math.max(0, idx - 1);
  const to = Math.min(CEFR_ORDER.length - 1, idx + 1);
  return CEFR_ORDER.slice(from, to + 1);
}

/**
 * Лёгкий EXISTS-запрос: есть ли в общей базе хотя бы одно слово, доступное
 * для обзора этому юзеру (теми же фильтрами что getReviewFeedNext).
 *
 * Используется в /api/learning/next чтобы отличить «пул пуст, но обзор
 * можно набирать дальше» (embedded_review) от «исчерпан CEFR-пул»
 * (embedded_review_empty).
 */
export async function hasAvailableForReview(
  userId: number,
  cefr: string | null = null,
): Promise<boolean> {
  const cefrLevels = getCefrRange(cefr);
  const result = await db.execute(sql`
    SELECT 1
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    LEFT JOIN user_word_progress uwp
      ON uwp.meaning_id = wm.id AND uwp.user_id = ${userId}
    WHERE
      wm.cefr = ANY(ARRAY[${sql.join(cefrLevels.map(l => sql`${l}::cefr_level`), sql`, `)}])
      AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
      AND ${NON_FUNCTIONAL_SQL}
      AND (
        uwp.id IS NULL
        OR (uwp.state = 'snoozed' AND uwp.snoozed_until IS NOT NULL AND uwp.snoozed_until <= NOW())
      )
    LIMIT 1
  `);
  return (result as unknown as { rows: unknown[] }).rows.length > 0;
}

/**
 * Получить следующую порцию слов для обзора.
 *
 * `excludeWordIds` — слова, которые клиент уже подгрузил в текущей сессии
 * (для бесконечной подгрузки без повторов). Сетевая стоимость одного слова
 * включает массив meanings — обычно 1-3 значения, json небольшой.
 */
export async function getReviewFeedNext(
  userId: number,
  opts: { limit?: number; cefr?: string | null; excludeWordIds?: number[] } = {},
): Promise<ReviewFeedWord[]> {
  const limit = Math.min(Math.max(opts.limit ?? 15, 1), 50);
  const cefrLevels = getCefrRange(opts.cefr ?? null);
  const excluded = opts.excludeWordIds ?? [];

  const result = await db.execute(sql`
    SELECT
      w.id AS word_id,
      w.text AS word_text,
      w.transcription,
      json_agg(
        json_build_object(
          'meaning_id', wm.id,
          'translation', wm.translation,
          'part_of_speech', wm.part_of_speech,
          'popularity_rank', wm.popularity_rank,
          'examples_content', ex_content.content,
          'yandex_examples', wm.examples
        )
        ORDER BY wm.popularity_rank NULLS LAST, wm.id
      ) AS meanings
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    LEFT JOIN user_word_progress uwp
      ON uwp.meaning_id = wm.id AND uwp.user_id = ${userId}
    LEFT JOIN word_ai_content ex_content
      ON ex_content.meaning_id = wm.id AND ex_content.content_type = 'examples'
    WHERE
      wm.cefr = ANY(ARRAY[${sql.join(cefrLevels.map(l => sql`${l}::cefr_level`), sql`, `)}])
      AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
      AND ${NON_FUNCTIONAL_SQL}
      AND (
        uwp.id IS NULL
        OR (uwp.state = 'snoozed' AND uwp.snoozed_until IS NOT NULL AND uwp.snoozed_until <= NOW())
      )
      ${excluded.length > 0 ? sql`AND w.id NOT IN (${sql.join(excluded.map(id => sql`${id}`), sql`, `)})` : sql``}
    GROUP BY w.id, w.text, w.transcription, w.frequency_rank
    ORDER BY w.frequency_rank NULLS LAST, RANDOM()
    LIMIT ${limit}
  `);

  type RawMeaning = {
    meaning_id: number;
    translation: string;
    part_of_speech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
    popularity_rank: number | null;
    examples_content: { sentences?: { en: string; ru: string }[] } | null;
    yandex_examples: { text: string; translation: string }[] | null;
  };
  type Row = {
    word_id: number;
    word_text: string;
    transcription: string | null;
    meanings: RawMeaning[];
  };

  const rows = (result as unknown as { rows: Row[] }).rows;
  return rows.map((r): ReviewFeedWord => {
    const sorted = r.meanings; // уже отсортированы json_agg ORDER BY
    const first = sorted[0]!;
    // Пример — из AI-контента (предпочтительно), иначе из Yandex.
    const aiSentence = first.examples_content?.sentences?.[0];
    const yandexEx = first.yandex_examples?.[0];
    const exampleEn = aiSentence?.en ?? yandexEx?.text;
    const exampleRu = aiSentence?.ru ?? yandexEx?.translation;
    return {
      wordId: r.word_id,
      text: r.word_text,
      transcription: r.transcription,
      partOfSpeech: first.part_of_speech,
      meanings: sorted.map((m, i): ReviewFeedMeaning => ({
        meaningId: m.meaning_id,
        translation: m.translation,
        // Examples только у первого meaning. Graceful skip — поля undefined,
        // если у этого meaning нет ни AI-, ни Yandex-примеров.
        ...(i === 0 && exampleEn && exampleRu ? { exampleEn, exampleRu } : {}),
      })),
    };
  });
}
