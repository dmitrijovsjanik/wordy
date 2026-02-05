# Code Style

## Naming
- **Files/folders**: `kebab-case` — `quiz-card.tsx`, `use-timer.ts`, `game-service.ts`
- **Components**: `PascalCase` — `QuizCard`, `DuelLobby`
- **Hooks**: `camelCase` with `use` prefix — `useTimer`, `useDuel`
- **Stores**: `camelCase` with `Store` suffix — `gameStore.ts`, `userStore.ts`
- **Types/Interfaces**: `PascalCase`, interfaces with `I` prefix only for contracts — `User`, `QuizQuestion`, `IGameService`
- **Constants**: `UPPER_SNAKE_CASE` — `MAX_LIVES`, `QUIZ_TIME_LIMIT`
- **DB tables/columns**: `snake_case` — `user_progress`, `created_at`

## Components
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

## Imports
Order (enforced by ESLint):
1. React / external libraries
2. Internal aliases (`@/components`, `@/hooks`, `@/lib`, `@/stores`, `@/types`)
3. Relative imports (styles, local helpers)

Use path aliases — **NO deep relative paths** like `../../../lib/utils`.

## State Management (Zustand)
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

## Error Handling
- API calls: always handle errors, show user-friendly messages in Russian
- Use `try/catch` in async functions, never leave promises unhandled
- Server errors return consistent shape: `{ error: string; code: string }`
- Client-side: toast notifications for errors, never silent failures

## Comments
- Code should be self-explanatory. Comments only for **why**, not **what**
- No JSDoc for obvious functions. Add JSDoc only for public API, complex algorithms, or non-obvious behavior
- TODO format: `// TODO(dima): description` or `// TODO(danya): description`

## Performance
- `React.memo` only when profiling shows re-render problems — not by default
- Lazy-load routes with `React.lazy` + `Suspense`
- Images: WebP, lazy loading, explicit width/height
- Minimize dependencies — every new package must justify its bundle cost
