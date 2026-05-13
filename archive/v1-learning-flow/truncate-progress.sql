-- Очистка пользовательского прогресса после редизайна learning-flow.
-- Запустить ОДИН раз руками: после этого юзеры стартуют с пустого pool.
-- Пользовательские коллекции (collections, collection_words, user_collections)
-- НЕ трогаются.

BEGIN;

TRUNCATE user_word_progress, user_word_progress_word RESTART IDENTITY CASCADE;

-- learning_events можно оставить (аналитика истории действий). Если хочется
-- начисто — раскомментируй:
-- TRUNCATE learning_events RESTART IDENTITY;

COMMIT;
