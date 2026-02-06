import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { TelegramProvider } from '@/components/telegram-provider';
import { BottomTabs } from '@/components/bottom-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserStore } from '@/stores/user-store';
import { telegram } from '@/lib/telegram';
import { acceptInvite, sendFriendRequest } from '@/lib/api';

const Home = lazy(() => import('@/components/home').then((m) => ({ default: m.Home })));
const Collections = lazy(() => import('@/components/collections').then((m) => ({ default: m.Collections })));
const CollectionDetail = lazy(() => import('@/components/collection-detail').then((m) => ({ default: m.CollectionDetail })));
const CollectionCreate = lazy(() => import('@/components/collection-create').then((m) => ({ default: m.CollectionCreate })));
const ErrorsCollection = lazy(() => import('@/components/errors-collection').then((m) => ({ default: m.ErrorsCollection })));
const Profile = lazy(() => import('@/components/profile').then((m) => ({ default: m.Profile })));
const DuelCreate = lazy(() => import('@/components/duel-create').then((m) => ({ default: m.DuelCreate })));
const DuelGame = lazy(() => import('@/components/duel-game').then((m) => ({ default: m.DuelGame })));
const DuelResult = lazy(() => import('@/components/duel-result').then((m) => ({ default: m.DuelResult })));
const Leaderboard = lazy(() => import('@/components/leaderboard'));
const Modes = lazy(() => import('@/components/modes').then((m) => ({ default: m.Modes })));
const Shop = lazy(() => import('@/components/shop').then((m) => ({ default: m.Shop })));
const TestHeader = lazy(() => import('@/components/test-header').then((m) => ({ default: m.TestHeader })));
const FriendsPage = lazy(() => import('@/components/friends').then((m) => ({ default: m.Friends })));

function DeepLinkHandler() {
  const navigate = useNavigate();
  const isAuthenticated = useUserStore((s) => s.isAuthenticated);
  const processed = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || processed.current) return;

    const startParam = telegram.startParam;
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
    } else if (startParam?.startsWith('duel_')) {
      processed.current = true;
      const duelId = startParam.slice(5);
      navigate(`/duel/${duelId}`, { replace: true });
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

export function App() {
  return (
    <BrowserRouter>
      <TelegramProvider>
        <DeepLinkHandler />
        <div className="tg-safe-area mx-auto flex h-dvh max-w-md flex-col">
          <main className="flex-1 overflow-y-auto">
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/collections" element={<Collections />} />
                <Route path="/collections/create" element={<CollectionCreate />} />
                <Route path="/collections/:id" element={<CollectionDetail />} />
                <Route path="/errors" element={<ErrorsCollection />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/duel/create" element={<DuelCreate />} />
                <Route path="/duel/:id" element={<DuelGame />} />
                <Route path="/duel/:id/result" element={<DuelResult />} />
                <Route path="/leaderboard" element={<Leaderboard />} />
                <Route path="/modes" element={<Modes />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/test-header" element={<TestHeader />} />
              </Routes>
            </Suspense>
          </main>
          <BottomTabs />
        </div>
      </TelegramProvider>
    </BrowserRouter>
  );
}
