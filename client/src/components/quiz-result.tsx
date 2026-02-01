import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/stores/game-store';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { useMainButton } from '@/hooks/use-main-button';
import { useTelegram } from '@/hooks/use-telegram';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BackButton } from '@/components/ui/back-button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Fire02Icon, Award01Icon, Target02Icon } from '@hugeicons/core-free-icons';

export function QuizResult() {
  const navigate = useNavigate();
  const { hapticNotification } = useTelegram();
  const result = useGameStore((s) => s.result);
  const resetGame = useGameStore((s) => s.reset);
  const refreshProfile = useUserStore((s) => s.refreshProfile);

  const goHome = useCallback(() => {
    resetGame();
    navigate('/');
  }, [resetGame, navigate]);

  useBackButton(goHome);
  useMainButton('На главную', goHome);

  useEffect(() => {
    if (!result) {
      navigate('/', { replace: true });
      return;
    }
    hapticNotification('success');
    refreshProfile();
  }, [result, navigate, hapticNotification, refreshProfile]);

  if (!result) return null;

  const accuracy = result.totalCount > 0
    ? Math.round((result.correctCount / result.totalCount) * 100)
    : 0;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-6 pb-8">
      {/* Back */}
      <div className="w-full">
        <BackButton onClick={goHome} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center w-full">
        <h1 className="text-2xl font-bold">Результат</h1>

        <div className="mt-6 grid w-full grid-cols-2 gap-3">
          <Card className="flex flex-col items-center">
            <HugeiconsIcon icon={Target02Icon} size={24} className="text-[var(--brand-9)]" />
            <span className="mt-2 text-2xl font-bold">{result.correctCount}/{result.totalCount}</span>
            <span className="text-sm text-[var(--gray-11)]">Правильных</span>
          </Card>

          <Card className="flex flex-col items-center">
            <HugeiconsIcon icon={Award01Icon} size={24} className="text-[var(--amber-9)]" />
            <span className="mt-2 text-2xl font-bold">{accuracy}%</span>
            <span className="text-sm text-[var(--gray-11)]">Точность</span>
          </Card>
        </div>

        <Card className="mt-3 flex w-full items-center justify-between">
          <span className="text-[var(--gray-11)]">Опыт получен</span>
          <Badge>+{result.xpEarned} XP</Badge>
        </Card>

        {result.streak > 0 && (
          <Card className="mt-3 flex w-full items-center justify-between">
            <span className="text-[var(--gray-11)]">Серия</span>
            <Badge>
              <HugeiconsIcon icon={Fire02Icon} size={16} />
              {result.streak} дн.
            </Badge>
          </Card>
        )}
      </div>

      <div className="mt-auto w-full">
        <Button
          className="w-full"
          onClick={() => {
            resetGame();
            navigate('/quiz');
          }}
        >
          Ещё раз
        </Button>
      </div>
    </div>
  );
}
