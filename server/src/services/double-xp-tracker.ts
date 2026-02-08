/**
 * Double XP Tracker
 *
 * In-memory хранилище для серверной валидации таймера x2 XP.
 * Записывает момент генерации вопроса и проверяет, уложился ли игрок
 * в таймлимит при ответе.
 */

import { DOUBLE_XP_GRACE_MS } from '../config/double-xp-config.js';

export type DoubleXpEntry = {
  generatedAt: number; // Date.now()
  timeLimitMs: number;
};

const pending = new Map<string, DoubleXpEntry>();

export function setDoubleXp(key: string, entry: DoubleXpEntry): void {
  pending.set(key, entry);
  // Автоочистка через таймлимит + 30с (на случай если ответ не придёт)
  setTimeout(() => pending.delete(key), entry.timeLimitMs + 30_000);
}

export function validateAndConsume(key: string): boolean {
  const entry = pending.get(key);
  if (!entry) return false;
  pending.delete(key);
  const elapsed = Date.now() - entry.generatedAt;
  return elapsed <= entry.timeLimitMs + DOUBLE_XP_GRACE_MS;
}

export function makeKey(userId: number, meaningId: number): string {
  return `${userId}:${meaningId}`;
}

export function makeMatchPairsKey(userId: number, meaningIds: number[]): string {
  return `${userId}:mp:${[...meaningIds].sort((a, b) => a - b).join(',')}`;
}
