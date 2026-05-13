import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '@/hooks/use-back-button';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { learningProblems, type ProblemMeaning } from '@/lib/api';
import { useUnifiedGameStore } from '@/stores/unified-game-store';

/**
 * Экран «Проблемные слова». Слова, в которых юзер ошибался ≥3 раз за
 * последние 60 дней (см. серверный learning-config.errors).
 *
 * Кнопка «Повторить» переключает unifiedGame в problemsMode и ведёт на
 * главную, где показывается лестничный вопрос на проблемном слове.
 * Слово выходит из коллекции естественно: либо лестница его продвигает
 * (правильные ответы), либо ошибки выпадают из 60-дневного окна.
 */
export function ProblemsPage() {
  const navigate = useNavigate();
  const setProblemsMode = useUnifiedGameStore((s) => s.setProblemsMode);

  const [meanings, setMeanings] = useState<ProblemMeaning[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useBackButton(useCallback(() => navigate('/'), [navigate]));

  useEffect(() => {
    let alive = true;
    setIsLoading(true);
    setError(null);
    learningProblems()
      .then((res) => {
        if (!alive) return;
        setMeanings(res.meanings);
      })
      .catch(() => {
        if (!alive) return;
        setError('Не удалось загрузить');
      })
      .finally(() => alive && setIsLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const handleStart = useCallback(() => {
    setProblemsMode(true);
    navigate('/');
  }, [setProblemsMode, navigate]);

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-8">
      <BackButton onClick={() => navigate('/')} />

      <div className="mt-4 flex flex-col gap-1">
        <h1 className="text-xl font-bold">Проблемные слова</h1>
        <p className="text-sm text-[var(--gray-11)]">
          Слова, в которых ты ошибался за последние 60 дней.
        </p>
      </div>

      {isLoading && !meanings && (
        <div className="mt-6 flex flex-col gap-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      )}

      {error && (
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="text-center text-[var(--gray-11)]">{error}</p>
        </div>
      )}

      {!isLoading && !error && meanings && meanings.length === 0 && (
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="text-center text-[var(--gray-11)]">
            Проблемных слов нет. Так держать.
          </p>
          <Button variant="secondary" onClick={() => navigate('/')}>
            На главную
          </Button>
        </div>
      )}

      {!isLoading && !error && meanings && meanings.length > 0 && (
        <>
          <div className="mt-6 flex flex-col gap-2">
            {meanings.map((m) => (
              <div
                key={m.meaningId}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--gray-2)] px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{m.word}</span>
                  <span className="text-xs text-[var(--gray-11)]">{m.translation}</span>
                </div>
                <Badge variant="error" className="shrink-0">
                  {m.errorCount} {m.errorCount === 1 ? 'ошибка' : m.errorCount < 5 ? 'ошибки' : 'ошибок'}
                </Badge>
              </div>
            ))}
          </div>

          <div className="sticky bottom-4 mt-6">
            <Button
              variant="default"
              className="w-full"
              onClick={handleStart}
            >
              Повторить ({meanings.length})
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
