# Database

- Schema in `server/src/db/schema.ts`
- Use Drizzle ORM query patterns
- PostgreSQL on the same VPS (local connection)
- `npm run db:push` for dev, `npm run db:migrate` for prod

## DB Style & Principles
- **Tables/columns**: `snake_case` — `user_progress`, `word_meanings`, `created_at`
- **Primary keys**: `id` (serial или uuid — единообразно в рамках проекта)
- **Timestamps**: каждая таблица имеет `created_at` и `updated_at`
- **Soft delete**: `deleted_at` timestamp вместо физического удаления, где это имеет смысл (пользователи, контент)
- **Foreign keys**: всегда явные с `ON DELETE` стратегией (CASCADE, SET NULL, RESTRICT — осознанно)
- **Индексы**: на все поля в WHERE, JOIN, ORDER BY. Составные индексы для частых комбинаций
- **Enums**: использовать PostgreSQL enums для конечных наборов значений (game_type, answer_result)
- **Нормализация**: 3NF по умолчанию. Денормализация только с обоснованием производительности

## Полисемия (одно слово — несколько значений)
Слово "train" = и "поезд" и "тренировать". Это разные **значения** (meanings), не разные слова.

Модель данных:
- `words` — уникальное написание (`train`, `sheep`)
- `word_meanings` — конкретное значение слова (word_id + перевод + часть речи + контекст)
- В квизе пользователь видит **значение**, не слово. Варианты ответов — другие значения, не совпадающие с правильным

## Seed Data
- Начальный набор слов загружается скриптом: `npm run db:seed`
- Формат seed-файла: JSON или TS-массив в `server/src/db/seed/`
- Seed идемпотентный — повторный запуск не дублирует данные

## Popularity Rank (фильтрация переводов)
Yandex Dictionary API возвращает переводы отсортированные по популярности. Поле `word_meanings.popularity_rank` хранит позицию перевода (1 = самый популярный).

**Важно:**
- База хранит ВСЕ переводы из Yandex API
- Квизы используют только топ-N переводов (настраивается в `quiz-service.ts`)
- Константа `MAX_POPULARITY_RANK` в [quiz-service.ts](server/src/services/quiz-service.ts) — менять для расширения/сужения пула

**Скрипты:**
- `npm run db:enrich` — обогащает слова переводами, автоматически ставит `popularityRank`
- `npm run db:update-ranks` — миграция: проставляет ранги существующим meanings без ранга

**Как работает фильтр:**
```ts
const MAX_POPULARITY_RANK = 3; // Только топ-3 перевода

const popularityFilter = or(
  isNull(wordMeanings.popularityRank),  // старые данные без ранга
  lte(wordMeanings.popularityRank, MAX_POPULARITY_RANK),
);
```
