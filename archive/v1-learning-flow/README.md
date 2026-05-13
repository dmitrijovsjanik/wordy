# Archive: v1 learning flow

Сюда переехали файлы старого learning-flow и legacy-экранов после редизайна
обучения на новую лестницу `pool → passive → active → review → mastered`.

## Что было удалено из живого кода

### Server
- **Routes:** `quiz`, `duels`, `grammar`, `reading`, `review-feed`
- **Services:** `learning-service` (v1, 5-tier), `quiz-service`, `duel-service`,
  `grammar-service/`, `reading-service/`, `review-feed-service`,
  `problem-meanings-service`, `cooldown-service`, `quota-service`
- **Generators:** `multiple-choice`, `match-pairs`, `listening`, `dictation`,
  `cloze`, `cloze-input`, `spelling`, `encounter`, `collocation`, `grammar`,
  `tense-match-pairs`, `generate-for-tier` (v1)

### Client
- **Screens:** `vocabulary-screen` (v1), `embedded-review`, `duel-create/game/result`,
  `grammar/*`, `reading/*`, `review/*`, `leaderboard`, `modes`, `spelling-page`,
  `problems-page`
- **Question types:** `encounter-card`, `cloze`, `cloze-input`, `multiple-choice`,
  `match-pairs`, `listening`, `dictation`, `spelling`, `collocation`
- **Stores:** `duel-store`, `unified-game-store`
- **Game components:** `blank-sentence`, `double-xp-background/timer`,
  `hint-button`, `lives-exhausted-*`, `pronunciation-check`, `shadowing-prompt`,
  `streak-indicator`, `word-display`

## Что НЕ архивировано (живо)

- `league-store` (используется league-виджетами в dashboard/profile)
- `answer-history-drawer`, `collections-sheet` (используются в новом
  vocabulary-screen / learning-header)
- Все типы вопросов на которых построен новый flow: `pool-card`,
  `passive-recall-card`, `free-recall`

## Очистка БД-прогресса (TRUNCATE)

Пользовательский прогресс v1 (старые таблицы `user_word_progress` и старые
поля `learning_tier`/`state` в `user_word_progress_word`) больше не нужен —
v2 хранит всё в `learning_tier_v2`/`state_v2`.

Чтобы очистить прогресс юзеров и стартовать с чистой колоды:

```sql
-- /Users/ovsjanik/Documents/Pet\ Projects/wordy/archive/v1-learning-flow/truncate-progress.sql
TRUNCATE user_word_progress, user_word_progress_word RESTART IDENTITY CASCADE;
```

Запустить руками:

```bash
psql postgresql://localhost:5432/wordy < archive/v1-learning-flow/truncate-progress.sql
```

После этого все юзеры увидят пустой pool на `/vocabulary/learn`, и при первом
заходе сработает `ensurePoolFromCollection` — слова из коллекций (с правильным
фильтром eligible+non-functional) попадут в L0.

## Дроп старых БД-сущностей (отдельно)

В schema.ts остались **legacy enum'ы** `learning_tier` и `learning_state` —
они нужны пока в БД есть колонки с этими типами (`learning_events.tier_before/_after`,
старые колонки в `user_word_progress*`). Дропать их безопаснее в отдельной
миграции после того как:
1. analytics-сервис перейдёт на запись tier'ов через v2 enum (или мы дропнем
   тип колонки `tier_before/_after`)
2. Старые колонки `learning_tier`/`state` в `user_word_progress*` будут дропнуты
3. `learning_tier_v2` будет переименован в `learning_tier`

Это **отдельная задача**, не часть текущего cleanup.
