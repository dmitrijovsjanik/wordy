import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '@/hooks/use-back-button';
import { BackButton } from '@/components/ui/back-button';
import { CollocationQuiz } from '@/components/grammar/collocation-quiz';

/**
 * /vocabulary/phrases — Фразеологизмы.
 * Обёртка над существующим CollocationQuiz: тот же квиз, новая точка входа.
 * Внутреннее имя компонента и серверный generator (collocation.ts) не трогаются —
 * это рефакторинг отдельной задачей.
 */
export function PhrasesPage() {
  const navigate = useNavigate();
  const goBack = useCallback(() => navigate('/vocabulary'), [navigate]);
  useBackButton(goBack);

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={goBack} variant="ghost" />
        <h1 className="text-xl font-bold">Фразеологизмы</h1>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <CollocationQuiz />
      </div>
    </div>
  );
}
