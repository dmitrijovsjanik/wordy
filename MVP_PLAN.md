# MVP Plan — Wordy

## Scope

Telegram Mini App: квиз (4 варианта перевода), дуэли, XP + уровни + streak. Без лиг и рейтингов. Маленький seed-набор слов с поддержкой полисемии.

Dev mode на localhost без Telegram-авторизации.

---

## Phase 1: Project Setup (конфигурация)

### 1.1 Монорепо структура
- Создать `client/` и `server/` директории
- Root `package.json` с npm workspaces
- Общий `.gitignore`, `.editorconfig`

### 1.2 Client (Vite + React 19 + TypeScript)
- `npm create vite@latest client -- --template react-ts`
- Настроить path aliases (`@/` → `src/`) в `vite.config.ts` и `tsconfig.json`
- Установить: `zustand`, `react-router-dom`, `@radix-ui/colors`, `@hugeicons/react`, `@hugeicons/core-free-icons`
- Настроить shadcn/ui (CLI init → `client/src/components/ui/`)
- Tailwind config с Radix Colors CSS-переменными
- ESLint + Prettier config
- Dev mock для Telegram SDK (localhost работает без авторизации)

### 1.3 Server (Node.js + Fastify + TypeScript)
- Инициализировать `server/` с TypeScript, tsx (dev), tsup (build)
- Установить: `fastify`, `drizzle-orm`, `drizzle-kit`, `pg`, `@fastify/cors`
- `drizzle.config.ts` с PostgreSQL connection
- Dev-режим: если `NODE_ENV=development`, пропускать проверку `initData` и использовать mock-пользователя
- Prod-режим: валидация `initData` через HMAC-SHA256

### 1.4 Database schema (Drizzle)
Файл: `server/src/db/schema.ts`

**Таблицы:**

```
users
├── id (serial PK)
├── telegram_id (bigint, unique)
├── username (varchar, nullable)
├── first_name (varchar)
├── avatar_url (varchar, nullable)
├── xp (integer, default 0)
├── level (integer, default 1)
├── streak_days (integer, default 0)
├── last_activity_at (timestamp)
├── created_at (timestamp)
└── updated_at (timestamp)

words
├── id (serial PK)
├── text (varchar) — написание слова ("train")
├── language (varchar, default "en")
├── created_at (timestamp)
└── updated_at (timestamp)

word_meanings
├── id (serial PK)
├── word_id (FK → words)
├── translation (varchar) — перевод ("поезд")
├── part_of_speech (enum: noun, verb, adj, adv, phrase)
├── context_example (varchar, nullable) — "The train arrives at 5"
├── difficulty (enum: easy, medium, hard)
├── created_at (timestamp)
└── updated_at (timestamp)

quiz_sessions
├── id (serial PK)
├── user_id (FK → users)
├── type (enum: solo, duel)
├── score (integer)
├── correct_count (integer)
├── total_count (integer)
├── xp_earned (integer)
├── started_at (timestamp)
├── finished_at (timestamp, nullable)
└── created_at (timestamp)

quiz_answers
├── id (serial PK)
├── session_id (FK → quiz_sessions)
├── meaning_id (FK → word_meanings) — правильное значение
├── selected_meaning_id (FK → word_meanings, nullable) — что выбрал юзер
├── is_correct (boolean)
├── answer_time_ms (integer) — время ответа
└── created_at (timestamp)

duels
├── id (serial PK)
├── challenger_id (FK → users)
├── opponent_id (FK → users, nullable) — null пока ждём оппонента
├── status (enum: waiting, active, finished, cancelled)
├── winner_id (FK → users, nullable)
├── challenger_session_id (FK → quiz_sessions, nullable)
├── opponent_session_id (FK → quiz_sessions, nullable)
├── created_at (timestamp)
└── updated_at (timestamp)
```

### 1.5 Seed data
- `server/src/db/seed/words.ts` — 50-100 слов с meanings
- `npm run db:seed` — идемпотентный скрипт загрузки

---

## Phase 2: Backend API

### 2.1 Auth middleware
- `POST /api/auth/init` — принимает `initData` от Telegram, создаёт/обновляет юзера, возвращает JWT
- Dev mode: `GET /api/auth/dev` — возвращает JWT для mock-юзера без initData
- Middleware: проверяет JWT в `Authorization: Bearer <token>`, прикрепляет `user` к request

### 2.2 Quiz API
- `POST /api/quiz/start` — создаёт quiz_session, возвращает первый вопрос (meaning + 3 неправильных варианта)
- `POST /api/quiz/answer` — принимает ответ, записывает quiz_answer, возвращает результат + следующий вопрос
- `POST /api/quiz/finish` — завершает сессию, считает XP, обновляет streak
- Логика генерации вариантов: 3 неправильных meaning из той же difficulty, не совпадающие с правильным переводом

### 2.3 Duel API
- `POST /api/duels/create` — создаёт дуэль со статусом `waiting`
- `POST /api/duels/:id/join` — оппонент присоединяется
- `GET /api/duels/:id` — состояние дуэли
- Оба игрока проходят одинаковый набор вопросов (seed на основе duel.id)
- Победитель = больше правильных, при равенстве — быстрее по сумме answer_time_ms

### 2.4 User API
- `GET /api/users/me` — профиль, XP, уровень, streak
- `GET /api/users/me/stats` — статистика (всего игр, % правильных, лучший streak)

### 2.5 XP & Level system
- Правильный ответ: +10 XP
- Streak bonus: +5 XP за каждый ежедневный streak day
- Победа в дуэли: +50 XP
- Формула уровня: `level = floor(sqrt(xp / 100)) + 1`

---

## Phase 3: Frontend

### 3.1 Routing
```
/                → Home (начать квиз, дуэль, профиль)
/quiz            → Quiz game screen
/quiz/result     → Session results
/duel/create     → Создать/ждать дуэль
/duel/:id        → Duel game screen
/duel/:id/result → Duel results
/profile         → Профиль, статистика, уровень
```

### 3.2 Screens

**Home** — кнопки "Играть" (квиз), "Дуэль", внизу таб-навигация. Показывает streak, уровень, XP прогресс.

**Quiz** — карточка со словом, 4 варианта перевода. Таймер (опционально). Анимация правильного/неправильного ответа. Haptic feedback.

**Quiz Result** — очки, правильных/всего, XP earned, streak info. Кнопка "Ещё раз".

**Duel Create** — создать дуэль → получить invite link для шаринга в Telegram. Ожидание оппонента.

**Duel Game** — тот же quiz UI, но с индикатором прогресса оппонента.

**Duel Result** — кто победил, сравнение результатов.

**Profile** — аватар, имя, уровень + XP прогресс-бар, streak, общая статистика.

### 3.3 Telegram SDK integration
- `TelegramProvider` — инициализация SDK, expand(), theme sync
- Dev mode: mock provider с фейковыми themeParams и без auth
- MainButton: "Начать квиз", "Проверить", "Далее" — контекстно меняется
- BackButton: навигация назад
- HapticFeedback: на ответ (light — tap, success — правильно, error — неправильно)

---

## Phase 4: Duel real-time (WebSocket)

- Socket.io или простые polling для MVP
- Events: `duel:joined`, `duel:progress` (opponent answered N questions), `duel:finished`
- Решение: начать с **polling** (GET `/api/duels/:id` каждые 2сек) — проще, потом мигрировать на WS

---

## Dev Mode (localhost без авторизации)

- `VITE_DEV_MODE=true` в `.env` клиента
- Клиент: если dev mode, не инициализирует Telegram SDK, использует mock theme, автоматически получает dev-токен
- Сервер: если `NODE_ENV=development`, эндпоинт `/api/auth/dev` отдаёт JWT для тестового юзера (id=1, name="Dev User")
- Все остальные API работают одинаково в dev и prod

---

## Verification

1. `cd client && npm run build` — фронт собирается без ошибок
2. `cd server && npm run build` — бэк компилируется
3. `npm run typecheck` — нет TS ошибок
4. `npm run db:push && npm run db:seed` — схема и данные загружаются
5. Открыть `localhost:5173` — home screen отображается, квиз работает без Telegram
6. Пройти квиз, увидеть результаты, проверить XP начисление
7. Создать дуэль, присоединиться вторым табом, проверить flow
