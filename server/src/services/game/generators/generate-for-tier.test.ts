/**
 * Тесты generateForTier — диспетчер генератора по tier_v2.
 * Использует реальную БД (нужен хотя бы один word с eligible meaning).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { generateForTier } from './generate-for-tier.js';

let testWordId: number | null = null;

async function checkDb(): Promise<boolean> {
  try { await db.execute(sql`SELECT 1`); return true; } catch { return false; }
}

const dbAvailable = await checkDb();

describe.skipIf(!dbAvailable)('generateForTier', () => {
  beforeAll(async () => {
    // Берём первое слово с eligible meaning
    const rows = await db.execute(sql`
      SELECT wm.word_id FROM word_meanings wm
      WHERE (wm.popularity_rank IS NULL OR wm.popularity_rank <= 3)
        AND (wm.frequency IS NULL OR wm.frequency >= 5)
        AND wm.translation ~ '[а-яА-ЯёЁ]'
      LIMIT 1
    `);
    const row = (rows as unknown as { rows: Array<{ word_id: number }> }).rows[0];
    testWordId = row ? Number(row.word_id) : null;
    expect(testWordId).not.toBeNull();
  });

  it('tier=pool → возвращает pool-card вопрос', async () => {
    const res = await generateForTier(testWordId!, 'pool');
    expect(res).not.toBeNull();
    expect(res!.question.type).toBe('pool-card');
    if (res!.question.type === 'pool-card') {
      expect(res!.question.wordId).toBe(testWordId);
      expect(res!.question.meanings.length).toBeGreaterThan(0);
    }
  });

  it('tier=passive → возвращает passive-recall', async () => {
    const res = await generateForTier(testWordId!, 'passive');
    expect(res).not.toBeNull();
    expect(res!.question.type).toBe('passive-recall');
  });

  it('tier=active → возвращает free-recall ru→en', async () => {
    const res = await generateForTier(testWordId!, 'active');
    expect(res).not.toBeNull();
    expect(res!.question.type).toBe('free-recall');
    if (res!.question.type === 'free-recall') {
      expect(res!.question.direction).toBe('ru-en');
      expect(res!.question.acceptableAnswers.length).toBeGreaterThan(0);
    }
  });

  it('tier=review → возвращает free-recall (как active)', async () => {
    const res = await generateForTier(testWordId!, 'review');
    expect(res).not.toBeNull();
    expect(res!.question.type).toBe('free-recall');
  });

  it('tier=mastered → null (выпущен, не показывается)', async () => {
    const res = await generateForTier(testWordId!, 'mastered');
    expect(res).toBeNull();
  });

  it('несуществующий wordId → null', async () => {
    const res = await generateForTier(99_999_999, 'pool');
    expect(res).toBeNull();
  });
});
