import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TelegramProvider } from '@/components/telegram-provider';
import { Skeleton } from '@/components/ui/skeleton';

const Home = lazy(() => import('@/components/home').then((m) => ({ default: m.Home })));
const Quiz = lazy(() => import('@/components/quiz').then((m) => ({ default: m.Quiz })));
const QuizResult = lazy(() => import('@/components/quiz-result').then((m) => ({ default: m.QuizResult })));
const DuelCreate = lazy(() => import('@/components/duel-create').then((m) => ({ default: m.DuelCreate })));
const DuelGame = lazy(() => import('@/components/duel-game').then((m) => ({ default: m.DuelGame })));
const DuelResult = lazy(() => import('@/components/duel-result').then((m) => ({ default: m.DuelResult })));
const Profile = lazy(() => import('@/components/profile').then((m) => ({ default: m.Profile })));

function PageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col gap-4 p-4">
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
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/quiz/result" element={<QuizResult />} />
            <Route path="/duel/create" element={<DuelCreate />} />
            <Route path="/duel/:id" element={<DuelGame />} />
            <Route path="/duel/:id/result" element={<DuelResult />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Suspense>
      </TelegramProvider>
    </BrowserRouter>
  );
}
