import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '@/hooks/use-back-button';
import { BackButton } from '@/components/ui/back-button';
import { FalseFriendsQuiz } from '@/components/grammar/false-friends-quiz';

/**
 * /vocabulary/lexical-traps — Тонкости лексики.
 * Обёртка над существующим FalseFriendsQuiz: тот же квиз, новая точка входа.
 * Внутреннее имя компонента и серверный сервис (false-friends-service) не
 * трогаются — это рефакторинг отдельной задачей.
 */
export function LexicalTrapsPage() {
  const navigate = useNavigate();
  const goBack = useCallback(() => navigate('/vocabulary'), [navigate]);
  useBackButton(goBack);

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={goBack} variant="ghost" />
        <h1 className="text-xl font-bold">Тонкости лексики</h1>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <FalseFriendsQuiz />
      </div>
    </div>
  );
}
