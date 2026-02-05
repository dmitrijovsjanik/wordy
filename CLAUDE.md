# Wordy — Claude Code Configuration

## Project Overview

**Wordy** — Telegram Mini App для изучения английских слов и фраз в игровой форме. Квизы, составление слов, дуэли, рейтинги, лиги, система уровней и опыта.

- **Platform**: Telegram Mini App (WebView SPA)
- **Frontend**: Vite + React 19 + TypeScript
- **UI**: shadcn/ui components + Radix Colors (12-step palette)
- **Icons**: Hugeicons (`@hugeicons/core-free-icons` — only free collection)
- **Backend**: Node.js + TypeScript (framework TBD)
- **Database**: PostgreSQL + Drizzle ORM
- **Target audience**: СНГ (Russian-speaking users learning English)
- **Developers**: AI-assisted development via Claude Code

---

## Critical Rules

- **ALWAYS use shadcn/ui components** — never write raw HTML inputs, buttons, or other interactive elements. If a shadcn component exists in `client/src/components/ui/` (Button, Input, Card, Skeleton, Badge, Progress, etc.), use it. If a needed component doesn't exist yet — create it in `client/src/components/ui/` following shadcn conventions before using it. No inline-styled `<input>`, `<button>`, or `<select>` elements.
- TypeScript strict mode everywhere
- Functional components with hooks only
- **NO class components**
- **NO `any` type** — use `unknown` and narrow
- Interface language: Russian. Learning content: English
- All user-facing text in Russian (no i18n framework needed yet — single locale)
- Keep bundle size minimal — this loads inside Telegram's WebView
- Validate `initData` from Telegram on the server — NEVER trust client-side data
- **NO Docker** — deploy directly on VPS

---

## Detailed Documentation

Подробная документация вынесена в отдельные файлы. **Читай нужный файл перед началом работы:**

| Файл | Когда читать |
|------|-------------|
| [docs/code-style.md](docs/code-style.md) | **Любое написание/изменение кода** — naming, components, imports, Zustand, error handling |
| [docs/ui-design.md](docs/ui-design.md) | **Работа с UI/компонентами/стилями** — mobile design, Gestalt, Radix Colors, shadcn/ui, Hugeicons |
| [docs/database.md](docs/database.md) | **Изменения схемы БД, миграции, работа со словами/meanings** — polysemy model, seed, popularity rank |
| [docs/game-architecture.md](docs/game-architecture.md) | **Новые типы вопросов, режимы игры, генераторы** — modes, question types, generators |
| [docs/progression.md](docs/progression.md) | **Начисление XP/LP, уровни, streak** — формулы, модификаторы, progression-service |
| [docs/multi-language-support.md](docs/multi-language-support.md) | **Добавление новых языков** — архитектура мультиязычности |

---

## Telegram Mini App

- SDK: `@tma.js/sdk-react` for Telegram integration
- Call `WebApp.expand()` on app mount
- Use `WebApp.MainButton`, `WebApp.BackButton` for native Telegram UX
- Use haptic feedback (`WebApp.HapticFeedback`) for game interactions
- Validate `initData` on server with HMAC-SHA256 using bot token
- Theme: respect `WebApp.themeParams` for Telegram-native appearance

---

## File Organization

```
wordy/
├── client/                # Vite + React SPA
│   ├── src/
│   │   ├── app/           # App entry, router, providers
│   │   ├── components/    # React components
│   │   │   ├── ui/        # shadcn/ui components
│   │   │   └── game/      # Game components (WordDisplay, etc.)
│   │   │       └── question-types/  # MultipleChoice, Spelling, etc.
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # Zustand stores
│   │   ├── lib/           # Utilities, API client, helpers
│   │   ├── types/         # TypeScript type definitions (game.ts, api.ts)
│   │   └── assets/        # Static assets (images, fonts)
│   ├── public/
│   ├── index.html
│   └── vite.config.ts
├── server/                # Node.js backend
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── db/            # Drizzle schema, migrations, queries
│   │   ├── services/      # Business logic
│   │   │   └── game/      # Game module (types, generators)
│   │   │       └── generators/  # Question generators
│   │   ├── config/        # Configuration (progression, league)
│   │   ├── middleware/    # Auth, validation, error handling
│   │   └── types/         # Shared types
│   └── drizzle.config.ts
├── docs/                  # Detailed documentation
│   ├── code-style.md
│   ├── ui-design.md
│   ├── database.md
│   ├── game-architecture.md
│   ├── progression.md
│   └── multi-language-support.md
├── CLAUDE.md              # This file (root config)
└── package.json           # Root workspace config
```

---

## Deployment

- **Single VPS** (Ubuntu)
- **Frontend**: `vite build` → static files served by nginx
- **Backend**: Node.js process managed by PM2
- **Database**: PostgreSQL running locally on VPS
- **NO Docker**, **NO CI/CD** (manual deploy for now)

---

## Quick Commands

```bash
# Client
cd client && npm run dev       # Dev server with HMR
cd client && npm run build     # Production build
cd client && npm run preview   # Preview production build

# Server
cd server && npm run dev       # Dev server with watch
cd server && npm run build     # Compile TypeScript
cd server && npm run start     # Production start

# Database
cd server && npm run db:push      # Push schema (dev)
cd server && npm run db:migrate   # Run migrations (prod)
cd server && npm run db:studio    # Drizzle Studio GUI

# Quality
npm run lint                   # ESLint
npm run typecheck              # TypeScript check
```
