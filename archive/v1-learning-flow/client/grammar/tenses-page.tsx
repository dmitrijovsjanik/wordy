import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '@/hooks/use-back-button';
import { BackButton } from '@/components/ui/back-button';
import { TenseQuiz } from '@/components/grammar/tense-quiz';
import { TenseReference } from '@/components/grammar/tense-reference';

type View = 'quiz' | 'reference';

/** /grammar/tenses — Времена. Toggle quiz/reference в локальном state. */
export function TensesPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>('quiz');

  const goBack = useCallback(() => navigate('/grammar'), [navigate]);
  useBackButton(goBack);

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      <div className="flex items-center gap-3">
        <BackButton onClick={goBack} variant="ghost" />
        <h1 className="text-xl font-bold">Времена</h1>
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {view === 'quiz' ? (
          <TenseQuiz onSwitchView={() => setView('reference')} />
        ) : (
          <TenseReference onSwitchView={() => setView('quiz')} />
        )}
      </div>
    </div>
  );
}
