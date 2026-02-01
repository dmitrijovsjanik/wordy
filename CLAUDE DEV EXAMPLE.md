# Development Patterns

## CRITICAL: Parallel Execution Patterns

### Golden Rule
**1 MESSAGE = ALL RELATED OPERATIONS**

All React/Next.js operations MUST be concurrent/parallel in a single message:
- Component Creation: ALWAYS batch ALL component files in ONE message
- State Management: ALWAYS batch ALL Zustand store setup together
- Testing: ALWAYS run ALL test suites in parallel
- API Routes: ALWAYS create route + component + store together

---

## Component Development

Always create related files in parallel:
```
[BatchTool]:
  - Write("src/components/feature/NewComponent.tsx", component)
  - Write("src/components/feature/NewComponent.test.tsx", tests)
  - Write("src/hooks/useNewFeature.ts", hook)
  - Write("src/types/feature.ts", types)
```

---

## API + Frontend + Store

Develop full feature stack together:
```
[BatchTool]:
  - Write("src/app/api/feature/route.ts", apiRoute)
  - Write("src/components/feature/FeatureComponent.tsx", component)
  - Write("src/stores/featureStore.ts", store)
  - Write("src/hooks/useFeature.ts", hook)
  - Write("src/__tests__/feature/FeatureComponent.test.tsx", tests)
```

---

## Full Feature Implementation Example

```
[BatchTool]:
  // API Routes (parallel)
  - Write("src/app/api/notifications/route.ts", notificationsApi)
  - Write("src/app/api/notifications/[id]/route.ts", notificationDetailApi)

  // Components (parallel)
  - Write("src/components/notifications/NotificationList.tsx", listComponent)
  - Write("src/components/notifications/NotificationItem.tsx", itemComponent)
  - Write("src/components/notifications/NotificationBadge.tsx", badgeComponent)
  - Write("src/components/notifications/index.ts", indexExport)

  // State Management
  - Write("src/stores/notificationStore.ts", zustandStore)
  - Write("src/hooks/useNotifications.ts", customHook)

  // Types
  - Write("src/types/notification.ts", typeDefinitions)

  // Tests (parallel)
  - Write("src/__tests__/components/NotificationList.test.tsx", componentTests)
  - Write("src/__tests__/stores/notificationStore.test.ts", storeTests)
  - Write("src/__tests__/hooks/useNotifications.test.ts", hookTests)

  // i18n
  - Edit("messages/en.json", addEnglishTranslations)
  - Edit("messages/ru.json", addRussianTranslations)
```

---

## Zustand Store Batch Pattern

```
[BatchTool]:
  - Write("src/stores/featureStore.ts", storeCode)
  - Write("src/hooks/useFeatureActions.ts", actionsHook)
  - Write("src/hooks/useFeatureSelectors.ts", selectorsHook)
  - Write("src/__tests__/stores/featureStore.test.ts", storeTests)
```

---

## Testing Batch Pattern

```
[BatchTool]:
  - Write("src/__tests__/components/MovieCard.test.tsx", componentTests)
  - Write("src/__tests__/hooks/useSwipe.test.ts", hookTests)
  - Write("src/__tests__/stores/swipeStore.test.ts", storeTests)
  - Write("src/__tests__/utils/shuffle.test.ts", utilTests)
  - Bash("npm run test:ci")
```

---

## Filmber-Specific Patterns

### Movie Card with Swipe
```typescript
// Use @use-gesture/react for swipe detection
import { useDrag } from '@use-gesture/react';
import { useSpring, animated } from '@react-spring/web';

const bind = useDrag(({ movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
  if (Math.abs(mx) > 150 || vx > 0.5) {
    // Trigger swipe action
    onSwipe(dx > 0 ? 'like' : 'skip');
  }
});
```

### Real-time Sync Pattern
```typescript
// Socket.io with Zustand
const useRoomSync = (roomCode: string) => {
  const socket = useSocket();
  const { setProgress } = useSwipeStore();

  useEffect(() => {
    socket.on('swipe_progress', setProgress);
    return () => socket.off('swipe_progress', setProgress);
  }, [socket, setProgress]);
};
```

### Multi-language Support
```typescript
// Always use next-intl for translations
import { useTranslations } from 'next-intl';

const t = useTranslations('MovieCard');
return <h1>{t('title')}</h1>;
```

---

## Performance Patterns

### React Optimization
- Use `React.memo` for expensive renders
- Use `useMemo`/`useCallback` for computed values
- Implement virtual scrolling for long lists
- Lazy load routes with `React.lazy`

### API Optimization
- Cache TMDB responses (30 days)
- Use connection pooling for PostgreSQL
- Implement request deduplication
- Compress API responses

### Image Optimization
- Use Next.js Image component
- Local poster caching in `public/uploads/posters/`
- WebP format where supported
