import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDuelStore } from '@/stores/duel-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Share01Icon, Loading03Icon } from '@hugeicons/core-free-icons';

export function DuelCreate() {
  const navigate = useNavigate();
  const { duel, isLoading, createDuel, startPolling, stopPolling, reset } = useDuelStore();

  const goHome = useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]);

  useBackButton(goHome);

  useEffect(() => {
    createDuel();
    return () => reset();
  }, [createDuel, reset]);

  useEffect(() => {
    if (duel && duel.status === 'waiting') {
      startPolling(duel.id);
    }
    return () => stopPolling();
  }, [duel?.id, duel?.status, startPolling, stopPolling]);

  useEffect(() => {
    if (duel && duel.status === 'active') {
      stopPolling();
      navigate(`/duel/${duel.id}`, { replace: true });
    }
  }, [duel?.status, duel?.id, navigate, stopPolling]);

  const shareDuelLink = useCallback(() => {
    if (!duel) return;
    const link = `${window.location.origin}/duel/${duel.id}`;

    if (navigator.share) {
      navigator.share({ text: 'Присоединяйся к дуэли в Wordy!', url: link });
    } else {
      navigator.clipboard.writeText(link);
    }
  }, [duel]);

  if (isLoading && !duel) {
    return (
      <div className="flex min-h-screen flex-col gap-4 px-4 pt-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-8 h-40 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-6 pb-8">
      {/* Back */}
      <div className="w-full">
        <BackButton onClick={goHome} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center w-full">
        <h1 className="text-xl font-bold">Дуэль создана</h1>

        <Card className="mt-6 flex w-full flex-col items-center gap-4 p-6">
          <HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-[var(--brand-9)]" />
          <p className="text-center text-[var(--gray-11)]">
            Ожидание оппонента...
          </p>
          <p className="text-center text-sm text-[var(--gray-11)]">
            Отправьте ссылку другу, чтобы начать дуэль
          </p>
        </Card>
      </div>

      <div className="mt-auto w-full">
        <Button className="w-full" onClick={shareDuelLink}>
          <HugeiconsIcon icon={Share01Icon} size={20} />
          Поделиться ссылкой
        </Button>
      </div>
    </div>
  );
}
