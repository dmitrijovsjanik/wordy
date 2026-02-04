import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TelegramProvider } from '@/components/telegram-provider';
import { BottomTabs } from '@/components/bottom-tabs';
import { Skeleton } from '@/components/ui/skeleton';

const Home = lazy(() => import('@/components/home').then((m) => ({ default: m.Home })));
const Collections = lazy(() => import('@/components/collections').then((m) => ({ default: m.Collections })));
const CollectionDetail = lazy(() => import('@/components/collection-detail').then((m) => ({ default: m.CollectionDetail })));
const CollectionCreate = lazy(() => import('@/components/collection-create').then((m) => ({ default: m.CollectionCreate })));
const Profile = lazy(() => import('@/components/profile').then((m) => ({ default: m.Profile })));
const DuelCreate = lazy(() => import('@/components/duel-create').then((m) => ({ default: m.DuelCreate })));
const DuelGame = lazy(() => import('@/components/duel-game').then((m) => ({ default: m.DuelGame })));
const DuelResult = lazy(() => import('@/components/duel-result').then((m) => ({ default: m.DuelResult })));

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
        <div className="mx-auto flex h-dvh max-w-md flex-col">
          <main className="flex-1 overflow-y-auto">
            <Suspense fallback={<PageSkeleton />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/collections" element={<Collections />} />
                <Route path="/collections/create" element={<CollectionCreate />} />
                <Route path="/collections/:id" element={<CollectionDetail />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/duel/create" element={<DuelCreate />} />
                <Route path="/duel/:id" element={<DuelGame />} />
                <Route path="/duel/:id/result" element={<DuelResult />} />
              </Routes>
            </Suspense>
          </main>
          <BottomTabs />
        </div>
      </TelegramProvider>
    </BrowserRouter>
  );
}
