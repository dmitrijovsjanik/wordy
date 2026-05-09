-- Диагностика состояния обучения для пилота. Замени :user_id на свой (в логах u=1).
-- Запускать в Drizzle Studio (npm run db:studio) или psql.

-- 1. Сколько слов в каждом state и tier
SELECT
  state,
  learning_tier,
  COUNT(*) AS n
FROM user_word_progress_word
WHERE user_id = 1
GROUP BY state, learning_tier
ORDER BY state, learning_tier;

-- 2. Размер активной колоды (как считает getActiveDeckSize)
SELECT COUNT(*) AS active_deck_size
FROM user_word_progress_word
WHERE user_id = 1
  AND state = 'learning'
  AND learning_tier IN ('encounter', 'passive', 'active');

-- 3. Размер pending pool
SELECT COUNT(*) AS pending_pool_size
FROM user_word_progress_word
WHERE user_id = 1
  AND state = 'pending_pool';

-- 4. Слова на production (L4) — текст, чтобы увидеть какие именно
SELECT
  w.id AS word_id,
  w.text AS word,
  upw.state,
  upw.learning_tier,
  upw.last_seen_at,
  upw.next_review_at
FROM user_word_progress_word upw
JOIN words w ON w.id = upw.word_id
WHERE upw.user_id = 1
  AND upw.learning_tier IN ('production', 'review')
ORDER BY upw.last_seen_at DESC NULLS LAST
LIMIT 20;

-- 5. user_word_progress (per-meaning) для production-слов — должно быть N записей на каждое
SELECT
  w.text AS word,
  w.id AS word_id,
  COUNT(uwp.id) AS meaning_count,
  STRING_AGG(uwp.meaning_id::text, ', ') AS meaning_ids
FROM user_word_progress uwp
JOIN word_meanings wm ON wm.id = uwp.meaning_id
JOIN words w ON w.id = wm.word_id
WHERE uwp.user_id = 1
  AND uwp.learning_tier IN ('production', 'review')
GROUP BY w.id, w.text
ORDER BY meaning_count DESC;
