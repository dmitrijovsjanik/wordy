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

## Code Style

### Naming
- **Files/folders**: `kebab-case` — `quiz-card.tsx`, `use-timer.ts`, `game-service.ts`
- **Components**: `PascalCase` — `QuizCard`, `DuelLobby`
- **Hooks**: `camelCase` with `use` prefix — `useTimer`, `useDuel`
- **Stores**: `camelCase` with `Store` suffix — `gameStore.ts`, `userStore.ts`
- **Types/Interfaces**: `PascalCase`, interfaces with `I` prefix only for contracts — `User`, `QuizQuestion`, `IGameService`
- **Constants**: `UPPER_SNAKE_CASE` — `MAX_LIVES`, `QUIZ_TIME_LIMIT`
- **DB tables/columns**: `snake_case` — `user_progress`, `created_at`

### Components
- One component per file. File name matches component name in kebab-case: `quiz-card.tsx` → `QuizCard`
- Co-locate component-specific styles, types, and helpers next to the component
- Props type declared above component: `type QuizCardProps = { ... }`
- Destructure props in function signature
- Extract logic into custom hooks when component exceeds ~100 lines

```tsx
// quiz-card.tsx
type QuizCardProps = {
  question: QuizQuestion;
  onAnswer: (answerId: string) => void;
};

export function QuizCard({ question, onAnswer }: QuizCardProps) {
  // ...
}
```

### Imports
Order (enforced by ESLint):
1. React / external libraries
2. Internal aliases (`@/components`, `@/hooks`, `@/lib`, `@/stores`, `@/types`)
3. Relative imports (styles, local helpers)

Use path aliases — **NO deep relative paths** like `../../../lib/utils`.

### State Management (Zustand)
- One store per domain: `gameStore`, `userStore`, `duelStore`
- Keep stores flat — no deeply nested objects
- Actions inside the store, selectors outside as hooks

```tsx
// stores/game-store.ts
export const useGameStore = create<GameState>()((set, get) => ({
  score: 0,
  lives: 3,
  addScore: (points: number) => set((s) => ({ score: s.score + points })),
  loseLife: () => set((s) => ({ lives: s.lives - 1 })),
}));

// Usage in component — select only what you need
const score = useGameStore((s) => s.score);
```

### Error Handling
- API calls: always handle errors, show user-friendly messages in Russian
- Use `try/catch` in async functions, never leave promises unhandled
- Server errors return consistent shape: `{ error: string; code: string }`
- Client-side: toast notifications for errors, never silent failures

### Comments
- Code should be self-explanatory. Comments only for **why**, not **what**
- No JSDoc for obvious functions. Add JSDoc only for public API, complex algorithms, or non-obvious behavior
- TODO format: `// TODO(dima): description` or `// TODO(danya): description`

### Performance
- `React.memo` only when profiling shows re-render problems — not by default
- Lazy-load routes with `React.lazy` + `Suspense`
- Images: WebP, lazy loading, explicit width/height
- Minimize dependencies — every new package must justify its bundle cost

---

## UX/UI Design Principles

**This is a mobile-only app.** It runs inside Telegram's WebView on phones. No desktop layout, no responsive breakpoints — design for 360-412px width screens.

### Mobile Design Rules
- **Touch targets**: minimum main action element size 48×48pt. Spacing between main tappable elements — 8px< minimum 4px.
- **Thumb zone**: primary actions (CTA, navigation) in the lower half of the screen where thumbs reach naturally
- **One primary action per screen** — reduce cognitive load, don't overwhelm with options
- **Bottom navigation** over top navigation — easier to reach, standard mobile pattern
- **No hover states** — there is no cursor on mobile. Focus on `:active` and `:focus-visible` states
- **Swipe gestures**: natural for cards, lists, dismissals. Use sparingly and always provide a tap alternative
- **Loading states**: skeleton screens over spinners. Never show a blank screen
- **Pull-to-refresh** where contextually appropriate (leaderboards, feed)
- **Safe areas**: respect `env(safe-area-inset-*)` for notches and system UI

### Gestalt Principles (apply in every screen)
- **Proximity**: group related elements close together, separate unrelated groups with whitespace. No explicit borders needed when spacing is clear
- **Similarity**: consistent visual treatment for same-type elements — all buttons look like buttons, all cards look like cards. Same color = same function
- **Continuity**: guide the eye in a natural reading flow (top→bottom, left→right). Align elements to a grid
- **Figure-Ground**: use elevation (shadows, overlays) to separate layers — modals float above content, cards above background
- **Common Region**: group related content inside cards/containers. A card = one logical unit

### Content & Microcopy
- Short, clear labels on buttons — verbs: "Начать", "Проверить", "Далее"
- Error messages explain what happened AND what to do: "Не удалось загрузить. Попробуйте ещё раз"
- Empty states: illustration + explanation + CTA ("Пока нет результатов. Начните первый квиз!")
- Success feedback: haptic + visual (animation/color change), not just text

### Telegram-Specific UX
- Use `MainButton` for primary screen action — it's native and always accessible
- Use `BackButton` instead of custom back navigation
- Respect `themeParams` — don't fight Telegram's color scheme
- Haptic feedback (`HapticFeedback.impactOccurred`) on key interactions: correct answer, level up, button press
- App should feel like part of Telegram, not a foreign webpage

---

## File Organization

```
wordy/
├── client/                # Vite + React SPA
│   ├── src/
│   │   ├── app/           # App entry, router, providers
│   │   ├── components/    # React components
│   │   │   └── ui/        # shadcn/ui components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── stores/        # Zustand stores
│   │   ├── lib/           # Utilities, API client, helpers
│   │   ├── types/         # TypeScript type definitions
│   │   └── assets/        # Static assets (images, fonts)
│   ├── public/
│   ├── index.html
│   └── vite.config.ts
├── server/                # Node.js backend
│   ├── src/
│   │   ├── routes/        # API route handlers
│   │   ├── db/            # Drizzle schema, migrations, queries
│   │   ├── services/      # Business logic
│   │   ├── middleware/     # Auth, validation, error handling
│   │   └── types/         # Shared types
│   └── drizzle.config.ts
├── CLAUDE.md
└── package.json           # Root workspace config
```

---

## UI Components & Styling

### shadcn/ui
Components live in `client/src/components/ui/`. Copy-pasted, fully owned. Customized with CSS variables, NOT Tailwind utility overrides.

### Radix Colors (12-step semantic scale)

Вся коммуникация по цветам — через номера шагов: "accent-9 для кнопки", "gray-11 для подписи". Не hex-коды. Это рекомендации — отходить по запросу.

**12 шагов:**

| Step | Назначение | Пример |
|------|-----------|--------|
| 1 | App background | Фон страницы |
| 2 | Subtle background | Фон карточки, секции |
| 3 | UI element background | Фон кнопки (ghost), инпута |
| 4 | Hovered element bg | Hover step 3 |
| 5 | Active/Selected element bg | Pressed/selected |
| 6 | Subtle border | Разделители |
| 7 | Element border | Границы инпутов, focus ring |
| 8 | Hovered border | Hover step 7 |
| 9 | Solid background | Цвет кнопок, бейджей, акцентов |
| 10 | Hovered solid bg | Hover step 9 |
| 11 | Low-contrast text | Подписи, placeholder, вторичный текст |
| 12 | High-contrast text | Заголовки, основной текст |

**Композиция палитры:**
- **Accent** (бренд): выбрать из Radix scales (`iris`, `blue`, `violet` и др.)
- **Neutral**: `gray` или тонированный (`slate`, `mauve`) — подбирать в пару к accent
- **Semantic**: `red`/`tomato` = ошибка, `green`/`jade` = успех, `amber` = предупреждение, `blue` = информация

```css
/* CSS-переменные */
--color-bg: var(--gray-1);
--color-bg-subtle: var(--gray-2);
--color-bg-element: var(--gray-3);
--color-bg-hover: var(--gray-4);
--color-bg-active: var(--gray-5);
--color-border: var(--gray-6);
--color-border-strong: var(--gray-7);
--color-solid: var(--accent-9);
--color-solid-hover: var(--accent-10);
--color-text-secondary: var(--gray-11);
--color-text: var(--gray-12);
```

### Hugeicons
```tsx
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen02Icon } from '@hugeicons/core-free-icons';

<HugeiconsIcon icon={BookOpen02Icon} size={20} />
```

**IMPORTANT**: Only use icons from `@hugeicons/core-free-icons` (free collection).

---

## Telegram Mini App

- SDK: `@tma.js/sdk-react` for Telegram integration
- Call `WebApp.expand()` on app mount
- Use `WebApp.MainButton`, `WebApp.BackButton` for native Telegram UX
- Use haptic feedback (`WebApp.HapticFeedback`) for game interactions
- Validate `initData` on server with HMAC-SHA256 using bot token
- Theme: respect `WebApp.themeParams` for Telegram-native appearance

---

## Database

- Schema in `server/src/db/schema.ts`
- Use Drizzle ORM query patterns
- PostgreSQL on the same VPS (local connection)
- `npm run db:push` for dev, `npm run db:migrate` for prod

### DB Style & Principles
- **Tables/columns**: `snake_case` — `user_progress`, `word_meanings`, `created_at`
- **Primary keys**: `id` (serial или uuid — единообразно в рамках проекта)
- **Timestamps**: каждая таблица имеет `created_at` и `updated_at`
- **Soft delete**: `deleted_at` timestamp вместо физического удаления, где это имеет смысл (пользователи, контент)
- **Foreign keys**: всегда явные с `ON DELETE` стратегией (CASCADE, SET NULL, RESTRICT — осознанно)
- **Индексы**: на все поля в WHERE, JOIN, ORDER BY. Составные индексы для частых комбинаций
- **Enums**: использовать PostgreSQL enums для конечных наборов значений (game_type, answer_result)
- **Нормализация**: 3NF по умолчанию. Денормализация только с обоснованием производительности

### Полисемия (одно слово — несколько значений)
Слово "train" = и "поезд" и "тренировать". Это разные **значения** (meanings), не разные слова.

Модель данных:
- `words` — уникальное написание (`train`, `sheep`)
- `word_meanings` — конкретное значение слова (word_id + перевод + часть речи + контекст)
- В квизе пользователь видит **значение**, не слово. Варианты ответов — другие значения, не совпадающие с правильным

### Seed Data
- Начальный набор слов загружается скриптом: `npm run db:seed`
- Формат seed-файла: JSON или TS-массив в `server/src/db/seed/`
- Seed идемпотентный — повторный запуск не дублирует данные

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
