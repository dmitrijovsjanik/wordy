-- ⚠️ DESTRUCTIVE: сбрасывает весь прогресс обучения для одного юзера.
-- Используй только для диагностики на dev. На проде НЕ запускать без бэкапа.
--
-- Замени :user_id на нужный (в логах u=1).
-- Что делает:
--   - удаляет все user_word_progress_word (word-level прогресс)
--   - удаляет все user_word_progress (meaning-level прогресс L4/review)
--   - удаляет learning_events (история ответов)
--   - сбрасывает users.dailyCorrectCount/dailyCorrectDate
--   - НЕ трогает: коллекции, активную коллекцию, friends, gems, streakDays
--
-- Запускай по одному блоку, проверяя что ожидаемо.

BEGIN;

-- 1. Прогресс
DELETE FROM user_word_progress_word WHERE user_id = 1;
DELETE FROM user_word_progress WHERE user_id = 1;

-- 2. История событий
DELETE FROM learning_events WHERE user_id = 1;

-- 3. Дневные счётчики milestones (чтобы пилотный milestone→streak начался с 0)
UPDATE users
SET
  daily_correct_count = 0,
  daily_correct_date = NULL,
  daily_streak_milestones_done = '',
  daily_correct_milestones_done = ''
WHERE id = 1;

-- Проверка перед COMMIT:
SELECT 'word_progress' AS t, COUNT(*) FROM user_word_progress_word WHERE user_id = 1
UNION ALL
SELECT 'meaning_progress', COUNT(*) FROM user_word_progress WHERE user_id = 1
UNION ALL
SELECT 'events', COUNT(*) FROM learning_events WHERE user_id = 1;
-- Все должны быть 0.

-- Если ОК — раскомментировать и выполнить:
-- COMMIT;

-- Если что-то не так:
ROLLBACK;
