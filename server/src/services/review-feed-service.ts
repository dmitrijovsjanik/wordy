/**
 * Review Feed Service — отбор карточек для режима обзора (фаза 4).
 *
 * Возвращает поток слов, по которым пользователь ещё не сделал явный выбор
 * (нет записи `user_word_progress`, либо запись в `state='snoozed'` с истекшим
 * `snoozed_until`). Клиент свайпает «знаю / не знаю / отложить» — изменения
 * пишет через `POST /api/learning/swipe` (см. routes/learning.ts).
 *
 * Логика отбора:
 *   - Уровень CEFR: совпадает с user.estimated_cefr ± 1 уровень.
 *     При null estimated_cefr — fallback на a1.
 *   - Только квиз-валидные значения: popularity_rank≤3, frequency≥5, кириллический перевод.
 *   - Исключаем: уже изученное (state='learning'), known_from_review, snoozed с активным
 *     snoozed_until > NOW.
 *   - Сортировка: по frequency_rank слова (более частотные впереди).
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { learningConfig } from '../config/learning-config.js';
import { NON_FUNCTIONAL_SQL } from '../db/word-filters.js';

export type ReviewFeedCard = {
  meaningId: number;
  word: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  cefr: string | null;
  example: { en: string; ru: string } | null;
  mnemonic: string | null;
};

/** Отдельный meaning внутри слова (без word/transcription — они на уровне группы). */
export type ReviewFeedMeaning = {
  meaningId: number;
  translation: string;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  cefr: string | null;
  example: { en: string; ru: string } | null;
  mnemonic: string | null;
};

/** Слово со всеми его значениями. Режим A в обзоре. */
export type ReviewFeedWord = {
  wordId: number;
  word: string;
  transcription: string | null;
  meanings: ReviewFeedMeaning[];
};

const CEFR_ORDER = ['a1', 'a2', 'b1', 'b2', 'c1'] as const;

function getCefrRange(userCefr: string | null): string[] {
  if (!userCefr) return ['a1', 'a2'];
  const idx = CEFR_ORDER.indexOf(userCefr.toLowerCase() as typeof CEFR_ORDER[number]);
  if (idx < 0) return ['a1', 'a2'];
  // ±1 уровень от текущего, в пределах массива.
  const from = Math.max(0, idx - 1);
  const to = Math.min(CEFR_ORDER.length - 1, idx + 1);
  return CEFR_ORDER.slice(from, to + 1);
}

export async function getReviewFeed(
  userId: number,
  opts: { limit?: number; cefr?: string | null } = {},
): Promise<ReviewFeedCard[]> {
  const limit = Math.min(Math.max(opts.limit ?? learningConfig.review.feedQueueSize, 1), 100);
  const cefrLevels = getCefrRange(opts.cefr ?? null);

  // Главный запрос: meanings, не имеющие активной записи в user_word_progress
  // или со state='snoozed' и истёкшим snoozed_until.
  // AI-content джойним left-side, чтобы не блокировать показ при отсутствии примеров.
  const result = await db.execute(sql`
    SELECT
      wm.id AS meaning_id,
      w.text AS word,
      wm.translation,
      w.transcription,
      wm.part_of_speech AS part_of_speech,
      wm.cefr,
      ex_content.content AS examples_content,
      mn_content.content AS mnemonic_content,
      wm.examples AS yandex_examples
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    LEFT JOIN user_word_progress uwp
      ON uwp.meaning_id = wm.id AND uwp.user_id = ${userId}
    LEFT JOIN word_ai_content ex_content
      ON ex_content.meaning_id = wm.id AND ex_content.content_type = 'examples'
    LEFT JOIN word_ai_content mn_content
      ON mn_content.meaning_id = wm.id AND mn_content.content_type = 'mnemonic'
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
    ORDER BY w.frequency_rank NULLS LAST, RANDOM()
    LIMIT ${limit}
  `);

  type Row = {
    meaning_id: number;
    word: string;
    translation: string;
    transcription: string | null;
    part_of_speech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
    cefr: string | null;
    examples_content: { sentences?: { en: string; ru: string; cefr?: string }[] } | null;
    mnemonic_content: { association?: string } | null;
    yandex_examples: { text: string; translation: string }[] | null;
  };

  const rows = (result as unknown as { rows: Row[] }).rows;
  return rows.map((r): ReviewFeedCard => {
    let example: { en: string; ru: string } | null = null;
    if (r.examples_content?.sentences && r.examples_content.sentences.length > 0) {
      const s = r.examples_content.sentences[0]!;
      example = { en: s.en, ru: s.ru };
    } else if (r.yandex_examples && r.yandex_examples.length > 0) {
      const ex = r.yandex_examples[0]!;
      example = { en: ex.text, ru: ex.translation };
    }
    return {
      meaningId: r.meaning_id,
      word: r.word,
      translation: r.translation,
      transcription: r.transcription,
      partOfSpeech: r.part_of_speech,
      cefr: r.cefr,
      example,
      mnemonic: r.mnemonic_content?.association ?? null,
    };
  });
}

/**
 * Режим A: возвращает слова со всеми подходящими значениями. Используется для
 * стопки внутри одной карточки (несколько meaning'ов одного слова).
 *
 * `excludeWordIds` — слова, которые клиент уже видел в текущей сессии
 * (для бесконечной подгрузки без повторов).
 */
export async function getReviewFeedWords(
  userId: number,
  opts: { limit?: number; cefr?: string | null; excludeWordIds?: number[] } = {},
): Promise<ReviewFeedWord[]> {
  const limit = Math.min(Math.max(opts.limit ?? 15, 1), 50);
  const cefrLevels = getCefrRange(opts.cefr ?? null);
  const excluded = opts.excludeWordIds ?? [];

  const result = await db.execute(sql`
    SELECT
      w.id AS word_id,
      w.text AS word,
      w.transcription,
      w.frequency_rank,
      json_agg(
        json_build_object(
          'meaning_id', wm.id,
          'translation', wm.translation,
          'part_of_speech', wm.part_of_speech,
          'cefr', wm.cefr,
          'examples_content', ex_content.content,
          'mnemonic_content', mn_content.content,
          'yandex_examples', wm.examples,
          'popularity_rank', wm.popularity_rank
        )
        ORDER BY wm.popularity_rank NULLS LAST, wm.id
      ) AS meanings
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    LEFT JOIN user_word_progress uwp
      ON uwp.meaning_id = wm.id AND uwp.user_id = ${userId}
    LEFT JOIN word_ai_content ex_content
      ON ex_content.meaning_id = wm.id AND ex_content.content_type = 'examples'
    LEFT JOIN word_ai_content mn_content
      ON mn_content.meaning_id = wm.id AND mn_content.content_type = 'mnemonic'
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

  type MeaningRow = {
    meaning_id: number;
    translation: string;
    part_of_speech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
    cefr: string | null;
    examples_content: { sentences?: { en: string; ru: string; cefr?: string }[] } | null;
    mnemonic_content: { association?: string } | null;
    yandex_examples: { text: string; translation: string }[] | null;
    popularity_rank: number | null;
  };
  type WordRow = {
    word_id: number;
    word: string;
    transcription: string | null;
    frequency_rank: number | null;
    meanings: MeaningRow[];
  };

  const rows = (result as unknown as { rows: WordRow[] }).rows;
  return rows.map((r): ReviewFeedWord => ({
    wordId: r.word_id,
    word: r.word,
    transcription: r.transcription,
    meanings: r.meanings.map((m): ReviewFeedMeaning => {
      let example: { en: string; ru: string } | null = null;
      if (m.examples_content?.sentences && m.examples_content.sentences.length > 0) {
        const s = m.examples_content.sentences[0]!;
        example = { en: s.en, ru: s.ru };
      } else if (m.yandex_examples && m.yandex_examples.length > 0) {
        const ex = m.yandex_examples[0]!;
        example = { en: ex.text, ru: ex.translation };
      }
      return {
        meaningId: m.meaning_id,
        translation: m.translation,
        partOfSpeech: m.part_of_speech,
        cefr: m.cefr,
        example,
        mnemonic: m.mnemonic_content?.association ?? null,
      };
    }),
  }));
}
