/**
 * In-memory K-cooldown для исключения слов на N следующих fetchNext.
 *
 * Заменяет 30-минутный nextReviewAt-кулдаун на промежуток в N запросов.
 * Зачем: «не показывать одно и то же слово два раза подряд» — это про
 * количество ходов, а не про время. На пилоте секунды между fetchNext.
 *
 * Семантика:
 *   - setCooldown(u, w, K) — слово w у юзера u пропустить ровно K следующих
 *     fetchNext, после чего вернуть в выборку.
 *   - getExcludedWordIds(u) — все wordId юзера u, у которых counter ≥ 0.
 *   - decrementOnFetch(u) — вызывается ОДИН раз на каждый /api/learning/next
 *     в начале; уменьшает все counters юзера u на 1, удаляет с counter < 0.
 *
 * Поведение при K=2:
 *   t0: setCooldown → counter=2
 *   t1: decrement → 1; excluded → блокирует
 *   t2: decrement → 0; excluded → блокирует (counter=0 ещё активен)
 *   t3: decrement → -1 → удалён; excluded пусто → слово доступно
 * Между показами одного и того же слова пройдут 2 запроса с другими словами.
 *
 * Сбрасывается при рестарте сервера (in-memory). На пилоте приемлемо.
 */

const cooldowns: Map<string, number> = new Map();

function makeKey(userId: number, wordId: number): string {
  return `${userId}:${wordId}`;
}

export function setCooldown(userId: number, wordId: number, count: number): void {
  if (count <= 0) {
    cooldowns.delete(makeKey(userId, wordId));
    return;
  }
  cooldowns.set(makeKey(userId, wordId), count);
}

export function getExcludedWordIds(userId: number): number[] {
  const prefix = `${userId}:`;
  const result: number[] = [];
  for (const [k, v] of cooldowns) {
    if (v >= 0 && k.startsWith(prefix)) {
      const wid = Number(k.substring(prefix.length));
      if (Number.isFinite(wid)) result.push(wid);
    }
  }
  return result;
}

export function decrementOnFetch(userId: number): void {
  const prefix = `${userId}:`;
  for (const [k, v] of cooldowns) {
    if (!k.startsWith(prefix)) continue;
    const next = v - 1;
    if (next < 0) cooldowns.delete(k);
    else cooldowns.set(k, next);
  }
}

/** Только для тестов. Production-код не должен звать. */
export function _resetAllCooldowns(): void {
  cooldowns.clear();
}
