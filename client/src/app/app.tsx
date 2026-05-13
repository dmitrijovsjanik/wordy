import { Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { TelegramProvider } from '@/components/telegram-provider';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { useUserStore } from '@/stores/user-store';
import { platformBridge } from '@/lib/platform-bridge';
import { acceptInvite, sendFriendRequest } from '@/lib/api';
import { lazyWithRetry } from '@/lib/lazy-retry';
import { PILOT_FEATURES } from '@/lib/pilot-config';

const Dashboard = lazyWithRetry(() => import('@/components/dashboard').then((m) => ({ default: m.Dashboard })));
const VocabularySection = lazyWithRetry(() => import('@/components/vocabulary-section').then((m) => ({ default: m.VocabularySection })));
const VocabularyScreen = lazyWithRetry(() => import('@/components/vocabulary-screen').then((m) => ({ default: m.VocabularyScreen })));
const PhrasesPage = lazyWithRetry(() => import('@/components/vocabulary/phrases-page').then((m) => ({ default: m.PhrasesPage })));
const LexicalTrapsPage = lazyWithRetry(() => import('@/components/vocabulary/lexical-traps-page').then((m) => ({ default: m.LexicalTrapsPage })));
const Collections = lazyWithRetry(() => import('@/components/collections').then((m) => ({ default: m.Collections })));
const CollectionDetail = lazyWithRetry(() => import('@/components/collection-detail').then((m) => ({ default: m.CollectionDetail })));
const CollectionCreate = lazyWithRetry(() => import('@/components/collection-create').then((m) => ({ default: m.CollectionCreate })));
const Profile = lazyWithRetry(() => import('@/components/profile').then((m) => ({ default: m.Profile })));
const Shop = lazyWithRetry(() => import('@/components/shop').then((m) => ({ default: m.Shop })));
const FriendsPage = lazyWithRetry(() => import('@/components/friends').then((m) => ({ default: m.Friends })));
const Settings = lazyWithRetry(() => import('@/components/settings').then((m) => ({ default: m.Settings })));
const AllWords = lazyWithRetry(() => import('@/components/all-words').then((m) => ({ default: m.AllWords })));
const DevRoutes = lazyWithRetry(() => import('@/components/dev-routes').then((m) => ({ default: m.DevRoutes })));

function DeepLinkHandler() {
  const navigate = useNavigate();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const processed = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || processed.current) return;

    const startParam = platformBridge.getStartParam();
    if (startParam?.startsWith('invite_')) {
      processed.current = true;
      const token = startParam.slice(7);
      acceptInvite(token)
        .then(() => navigate('/friends', { replace: true, state: { deepLink: 'invite_success' } }))
        .catch(() => navigate('/friends', { replace: true, state: { deepLink: 'invite_error' } }));
    } else if (startParam?.startsWith('friend_')) {
      processed.current = true;
      const code = startParam.slice(7);
      sendFriendRequest(code)
        .then(() => navigate('/friends', { replace: true, state: { deepLink: 'friend_success' } }))
        .catch(() => navigate('/friends', { replace: true, state: { deepLink: 'friend_error' } }));
    }
  }, [isAuthenticated, navigate]);

  return null;
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

// Приложение загрузилось — сбрасываем флаг chunk-reload через 5 секунд
// успешной работы, чтобы после следующего деплоя перезагрузка снова
// сработала. Раньше сброс был синхронным при mount app.tsx, но это создавало
// цикл reload'ов: если lazy-чанки сами падали (например, Vite 504 на
// outdated deps), флаг сбрасывался ДО их падения, и lazyWithRetry опять
// перезагружал страницу — навечно.
setTimeout(() => {
  sessionStorage.removeItem('chunk-reload');
}, 5000);

export function App() {
  return (
    <BrowserRouter>
      <TelegramProvider>
        <DeepLinkHandler />
        <div className="tg-safe-area mx-auto flex h-dvh max-w-md flex-col">
          <main className="flex-1 overflow-y-auto">
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/vocabulary" element={<VocabularySection />} />
                  <Route path="/vocabulary/learn" element={<VocabularyScreen />} />
                  <Route path="/vocabulary/phrases" element={<PhrasesPage />} />
                  <Route path="/vocabulary/lexical-traps" element={<LexicalTrapsPage />} />
                  <Route path="/collections" element={<Collections />} />
                  <Route path="/collections/create" element={<CollectionCreate />} />
                  <Route path="/collections/:id" element={<CollectionDetail />} />
                  <Route path="/profile" element={<Profile />} />
                  {PILOT_FEATURES.gems && (
                    <Route path="/shop" element={<Shop />} />
                  )}
                  {PILOT_FEATURES.friends && (
                    <Route path="/friends" element={<FriendsPage />} />
                  )}
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/words" element={<AllWords />} />
                  <Route path="/dev" element={<DevRoutes />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </TelegramProvider>
    </BrowserRouter>
  );
}
