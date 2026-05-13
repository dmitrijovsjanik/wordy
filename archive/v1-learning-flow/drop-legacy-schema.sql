-- Drop legacy БД-сущностей learning_tier v1 после редизайна на v2.
-- Запустить ОДИН раз после стабилизации v2-flow.
--
-- Что делает:
--   1. learning_events.tier_before/_after: ALTER TYPE legacy → v2 с маппингом
--      (encounter → pool, production → active, остальные совпадают).
--   2. Дропает user_word_progress (per-meaning, уже пустая).
--   3. Дропает legacy-колонки learning_tier и state в user_word_progress_word.
--   4. Дропает legacy pgEnum learning_tier и learning_state.
--   5. Переименовывает learning_tier_v2 → learning_tier (enum и колонку).
--   6. Переименовывает learning_state_v2 → learning_state (enum и колонку).

BEGIN;

-- ─── 1. learning_events: legacy enum → v2 enum ──────────────────────────────
-- Маппинг: encounter→pool, production→active, остальные (passive/active/review) совпадают.
ALTER TABLE learning_events
  ALTER COLUMN tier_before TYPE learning_tier_v2
  USING (CASE tier_before::text
    WHEN 'encounter'  THEN 'pool'::learning_tier_v2
    WHEN 'production' THEN 'active'::learning_tier_v2
    WHEN 'passive'    THEN 'passive'::learning_tier_v2
    WHEN 'active'     THEN 'active'::learning_tier_v2
    WHEN 'review'     THEN 'review'::learning_tier_v2
  END);

ALTER TABLE learning_events
  ALTER COLUMN tier_after TYPE learning_tier_v2
  USING (CASE tier_after::text
    WHEN 'encounter'  THEN 'pool'::learning_tier_v2
    WHEN 'production' THEN 'active'::learning_tier_v2
    WHEN 'passive'    THEN 'passive'::learning_tier_v2
    WHEN 'active'     THEN 'active'::learning_tier_v2
    WHEN 'review'     THEN 'review'::learning_tier_v2
  END);

-- ─── 2. Drop user_word_progress (per-meaning, уже пустая) ───────────────────
DROP TABLE IF EXISTS user_word_progress CASCADE;

-- ─── 3. Drop legacy-колонок в user_word_progress_word ───────────────────────
-- Перед drop'ом убедимся, что нет ссылок (default уже не нужен).
ALTER TABLE user_word_progress_word
  ALTER COLUMN learning_tier DROP DEFAULT,
  ALTER COLUMN state DROP DEFAULT;
ALTER TABLE user_word_progress_word
  DROP COLUMN learning_tier,
  DROP COLUMN state;

-- ─── 4. Drop legacy pgEnum'ов ───────────────────────────────────────────────
DROP TYPE IF EXISTS learning_tier;
DROP TYPE IF EXISTS learning_state;

-- ─── 5. Rename learning_tier_v2 → learning_tier ─────────────────────────────
ALTER TYPE learning_tier_v2 RENAME TO learning_tier;

-- В user_word_progress_word колонка learning_tier_v2 → learning_tier
ALTER TABLE user_word_progress_word RENAME COLUMN learning_tier_v2 TO learning_tier;

-- Индексы тоже переименовать (без суффикса _v2)
ALTER INDEX IF EXISTS user_word_progress_word_tier_v2_idx
  RENAME TO user_word_progress_word_tier_idx;

-- ─── 6. Rename learning_state_v2 → learning_state ───────────────────────────
ALTER TYPE learning_state_v2 RENAME TO learning_state;
ALTER TABLE user_word_progress_word RENAME COLUMN state_v2 TO state;
ALTER INDEX IF EXISTS user_word_progress_word_state_v2_idx
  RENAME TO user_word_progress_word_state_idx;

COMMIT;

-- Проверка после миграции:
\echo '=== After migration ==='
\d user_word_progress_word
SELECT typname FROM pg_type WHERE typname LIKE 'learning_%' OR typname = 'review_grade';
