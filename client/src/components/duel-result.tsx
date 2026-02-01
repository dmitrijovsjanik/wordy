import { useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDuelStore } from '@/stores/duel-store';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { useMainButton } from '@/hooks/use-main-button';
import { useTelegram } from '@/hooks/use-telegram';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { BackButton } from '@/components/ui/back-button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Award01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

export function DuelResult() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hapticNotification } = useTelegram();
  const user = useUserStore((s) => s.user);
  const refreshProfile = useUserStore((s) => s.refreshProfile);
  const { duel, winnerId, fetchDuel, reset } = useDuelStore();

  const goHome = useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]);

  useBackButton(goHome);
  useMainButton('На главную', goHome);

  useEffect(() => {
    if (id && !duel) {
      fetchDuel(Number(id));
    }
    refreshProfile();
  }, [id, duel, fetchDuel, refreshProfile]);

  const isWinner = winnerId === user?.id;
  const isDraw = winnerId === null;

  useEffect(() => {
    if (winnerId !== undefined) {
      hapticNotification(isWinner ? 'success' : 'error');
    }
  }, [winnerId, isWinner, hapticNotification]);

  if (!duel || !('challenger' in duel)) {
    return null;
  }

  const challenger = duel.challenger;
  const challengerSession = duel.challengerSession;
  const opponentSession = duel.opponentSession;

  return (
    <div className="flex min-h-full flex-col items-center px-4 pt-6 pb-8">
      {/* Back */}
      <div className="w-full">
        <BackButton onClick={goHome} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center w-full">
        {/* Result icon */}
        {isWinner ? (
          <>
            <HugeiconsIcon strokeWidth={2} icon={Award01Icon} size={48} className="text-[var(--amber-9)]" />
            <h1 className="mt-3 text-2xl font-bold">Победа!</h1>
          </>
        ) : isDraw ? (
          <h1 className="text-2xl font-bold">Ничья</h1>
        ) : (
          <>
            <HugeiconsIcon strokeWidth={2} icon={Cancel01Icon} size={48} className="text-[var(--red-9)]" />
            <h1 className="mt-3 text-2xl font-bold">Поражение</h1>
          </>
        )}

        {/* Score comparison */}
        <div className="mt-6 flex w-full gap-3">
          <Card className="flex flex-1 flex-col items-center">
            <span className="text-sm text-[var(--gray-11)]">{challenger.firstName}</span>
            <span className="mt-1 text-2xl font-bold">{challengerSession.correctCount}/{challengerSession.totalCount}</span>
            {duel.winnerId === duel.challengerId && (
              <Badge variant="primary" className="mt-2">Победитель</Badge>
            )}
          </Card>

          {opponentSession && (
            <Card className="flex flex-1 flex-col items-center">
              <span className="text-sm text-[var(--gray-11)]">{duel.opponent?.firstName ?? 'Оппонент'}</span>
              <span className="mt-1 text-2xl font-bold">{opponentSession.correctCount}/{opponentSession.totalCount}</span>
              {duel.winnerId === duel.opponentId && (
                <Badge variant="primary" className="mt-2">Победитель</Badge>
              )}
            </Card>
          )}
        </div>

        {isWinner && (
          <Badge className="mt-4 px-4 py-2 text-sm">+50 XP бонус</Badge>
        )}
      </div>
    </div>
  );
}
