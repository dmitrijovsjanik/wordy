# Filmber - Claude Code Configuration

## Project Overview

**Filmber** is a real-time movie matching web application that helps users discover movies collaboratively through Tinder-like swiping mechanics.

- **Version**: 2.6.0
- **Stack**: Next.js 16 + React 19 + TypeScript
- **Database**: PostgreSQL + Drizzle ORM
- **Real-time**: Socket.io
- **Platform**: Telegram Mini App

---

## Critical Rules

### Code Style
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use Zustand for state management (NOT Redux)
- Follow existing patterns in `src/stores/` for new stores
- Use `next-intl` for i18n (locales: `en`, `ru`)
- Use Tailwind CSS + Framer Motion for styling/animations

### UI Components & Icons
- **UI Library**: [HeroUI](https://heroui.com) components wrapped with shadcn/ui-compatible API in `src/components/ui/`
- **Pattern**: Components preserve shadcn/ui API externally while using HeroUI internally
- **Icons**: Use [hugeicons-react](https://github.com/hugeicons/hugeicons-react) from `@hugeicons/core-free-icons` (free collection only)

**Component usage example:**
```tsx
// Components use familiar shadcn/ui API
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogTitle>Title</DialogTitle>
    <Button variant="default">Action</Button>
  </DialogContent>
</Dialog>
```

**Icon usage example:**
```tsx
import { HugeiconsIcon } from '@hugeicons/react';
import { FilterIcon } from '@hugeicons/core-free-icons';

<HugeiconsIcon icon={FilterIcon} size={18} />
```

### File Organization
```
src/
├── app/              # Next.js App Router pages
│   ├── [locale]/     # Localized routes
│   └── api/          # API routes
├── components/       # React components
│   ├── ui/           # Reusable UI primitives
│   ├── movie/        # Movie-related components
│   ├── room/         # Room/pair mode components
│   └── lists/        # User lists components
├── hooks/            # Custom React hooks
├── stores/           # Zustand stores
├── lib/              # Core libraries
│   ├── api/          # External API clients (TMDB)
│   ├── db/           # Database schema and queries
│   ├── auth/         # Authentication logic
│   └── socket/       # WebSocket handlers
├── types/            # TypeScript definitions
└── i18n/             # Internationalization config
```

### API Integration
- **TMDB**: Primary movie data source
- All external API calls should use caching (30-day default)
- Use `src/lib/api/tmdb.ts` patterns for new integrations

### Database
- Schema in `src/lib/db/schema.ts`
- Use Drizzle ORM query patterns
- Run `npm run db:push` after schema changes
- Migrations via `npm run db:migrate`

### Authentication
- Telegram WebApp auth with HMAC-SHA256 validation
- JWT sessions stored in `user_sessions` table
- Auth logic in `src/lib/auth/`

### Deployment
- **ONLY deploy via GitHub Actions** - push to `main` branch triggers automatic deployment
- **NEVER use manual SSH commands** for git pull, build, or restart on the server
- Server: `filmber` (89.104.71.141)
- Shared env file: `/var/www/filmber/shared/.env`
- To add env variables: `ssh filmber "echo 'VAR=value' >> /var/www/filmber/shared/.env"`
- Database migrations run automatically during deploy via `npm run db:push`

---

## Quick Commands

```bash
# Development
npm run dev           # Start dev server
npm run build         # Production build
npm run start         # Production server

# Database
npm run db:push       # Push schema changes (dev)
npm run db:migrate    # Run migrations (prod)
npm run db:studio     # Drizzle Studio GUI

# Testing
npm test              # Run tests
npm run test:coverage # Coverage report
npm run test:ci       # CI mode

# Quality
npm run lint          # ESLint check
npm run typecheck     # TypeScript check
```

---

## Environment Variables

```env
# Required
DATABASE_URL=postgresql://...
TMDB_ACCESS_TOKEN=...
TELEGRAM_BOT_TOKEN=...
JWT_SECRET=...

# Optional
YANDEX_METRICA_ID=...
```

---

## Common Tasks

### Add New API Route
1. Create route in `src/app/api/[feature]/route.ts`
2. Add types in `src/types/`
3. Update store if needed
4. Add tests

### Add New Component
1. Create component in `src/components/[category]/`
2. Export from category index
3. Add translations to `messages/[locale].json`
4. Add tests

### Add New Store
1. Create store in `src/stores/[name]Store.ts`
2. Follow existing patterns
3. Add TypeScript types
4. Use `persist` middleware if needed

### Database Changes
1. Update schema in `src/lib/db/schema.ts`
2. Run `npm run db:generate`
3. Run `npm run db:push` (dev) or `npm run db:migrate` (prod)

---

## Contextual Documentation

Reference these files based on the task at hand:

| Task Type | Documentation File | When to Use |
|-----------|-------------------|-------------|
| **Feature Development** | [.claude/development.md](.claude/development.md) | Creating new features, batch operations, parallel execution patterns |
| **Testing** | [.claude/testing.md](.claude/testing.md) | Writing tests, coverage requirements, test organization |
| **State Management** | [.claude/state-management.md](.claude/state-management.md) | Creating Zustand stores, state patterns, memory management |
| **Real-time Features** | [.claude/realtime.md](.claude/realtime.md) | Socket.io events, WebSocket handlers, real-time sync |
| **React/UI Development** | [.claude/react-patterns.md](.claude/react-patterns.md) | Component design, animations, responsive design, performance |
| **Security Implementation** | [.claude/security.md](.claude/security.md) | Auth flows, security checklists, input validation |
| **DevOps & Deployment** | [.claude/devops.md](.claude/devops.md) | CI/CD, PM2, nginx, backups, disaster recovery |
| **Claude-Flow Usage** | [.claude/claude-flow.md](.claude/claude-flow.md) | Swarm commands, memory operations, verification |
| **Agent Coordination** | [.claude/agents.md](.claude/agents.md) | Multi-agent tasks, swarm topology, agent specialization |

### Usage Guidelines

**Before starting any task:**
1. Read this main file for project context
2. Reference the appropriate contextual file based on task type
3. Follow the patterns established in the contextual documentation

**For multi-domain tasks:**
- Reference multiple contextual files as needed
- Example: New feature with real-time sync → Read [development.md](.claude/development.md) + [realtime.md](.claude/realtime.md)

---

## Existing Stores Reference

| Store | Purpose |
|-------|---------|
| `authStore` | User authentication state |
| `roomStore` | Room/pair session state |
| `swipeStore` | Swipe progress tracking |
| `queueStore` | Movie queue for swiping |
| `listStore` | User's saved movies |
| `deckSettingsStore` | Deck filter preferences |
| `referralStore` | Referral data |
| `consentStore` | Cookie consent state |

---

## Socket.io Events Reference

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join_room` | Client → Server | User joins room |
| `leave_room` | Client → Server | User leaves room |
| `swipe` | Client → Server | User swipes on movie |
| `user_joined` | Server → Client | Partner joined notification |
| `swipe_progress` | Server → Client | Sync swipe progress |
| `match_found` | Server → Client | Both users liked same movie |
