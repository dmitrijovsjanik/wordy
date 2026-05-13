/**
 * Генератор упражнения для tier_v2. Принимает wordId + tier, грузит
 * representative meaning, диспатчит на соответствующий generator.
 *
 *   pool    → pool-card (свайп Знаю/Изучаю/Отложить)
 *   passive → passive-recall-card (узнавание)
 *   active  → free-recall (ввод, без grade-кнопок)
 *   review  → free-recall (ввод, клиент рендерит grade-кнопки после результата)
 *   mastered → null (не показывается)
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { wordMeanings } from '../../../db/schema.js';
import { NON_FUNCTIONAL_SQL } from '../../../db/word-filters.js';
import type { LearningTier } from '../../analytics-service.js';
import type {
  PooledMeaning,
  PoolCardQuestion,
  PassiveRecallCardQuestion,
  FreeRecallQuestion,
} from '../types.js';
import { generatePoolCard } from './pool-card.js';
import { generatePassiveRecallFromMeaning } from './passive-recall.js';
import { generateFreeRecallFromMeaning } from './free-recall.js';

export type TierQuestion =
  | PoolCardQuestion
  | PassiveRecallCardQuestion
  | FreeRecallQuestion;

export type GenerateForTierResult = {
  question: TierQuestion;
} | null;

/**
 * Подбор representative meaning для слова: минимальный popularity_rank
 * среди eligible (rank ≤ 3, frequency ≥ 5, кириллический перевод, не functional).
 *
 * На pool/passive/active/review — генерируем по этому representative meaning.
 * Клиент рендерит все meanings слова (приходят в `meanings`-поле), а
 * representative используется только как фокальная точка генератора.
 */
async function pickRepresentativeMeaning(wordId: number): Promise<number | null> {
  const result = await db.execute(sql`
    SELECT wm.id
    FROM word_meanings wm
    JOIN words w ON w.id = wm.word_id
    WHERE wm.word_id = ${wordId}
      AND (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
      AND (wm.frequency IS NULL OR wm.frequency >= 5)
      AND wm.translation ~ '[а-яА-ЯёЁ]'
      AND ${NON_FUNCTIONAL_SQL}
    ORDER BY wm.popularity_rank NULLS LAST, wm.id
    LIMIT 1
  `);
  const row = (result as unknown as { rows: Array<{ id: number }> }).rows[0];
  return row ? Number(row.id) : null;
}

async function loadPooledMeaning(meaningId: number): Promise<PooledMeaning | null> {
  const meaning = await db.query.wordMeanings.findFirst({
    where: eq(wordMeanings.id, meaningId),
    with: { word: true },
    columns: {
      id: true,
      wordId: true,
      translation: true,
      alternativeTranslations: true,
      difficulty: true,
      partOfSpeech: true,
      synonyms: true,
      examples: true,
    },
  });
  if (!meaning) return null;
  return meaning as PooledMeaning;
}

export async function generateForTier(
  wordId: number,
  tier: LearningTier,
): Promise<GenerateForTierResult> {
  if (tier === 'mastered') return null;

  const meaningId = await pickRepresentativeMeaning(wordId);
  if (meaningId === null) return null;
  const meaning = await loadPooledMeaning(meaningId);
  if (!meaning) return null;

  if (tier === 'pool') {
    const q = await generatePoolCard(meaning);
    return { question: q };
  }

  if (tier === 'passive') {
    const q = await generatePassiveRecallFromMeaning(meaning);
    return q ? { question: q } : null;
  }

  // active + review: одинаковый формат (free-recall ru→en со всеми meanings).
  // Различие — на стороне ответа: review требует grade.
  const q = await generateFreeRecallFromMeaning(meaning, {
    direction: 'ru-en',
    includeMeanings: true,
  });
  return q ? { question: q } : null;
}
