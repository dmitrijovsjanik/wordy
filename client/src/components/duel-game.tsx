import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDuelStore } from '@/stores/duel-store';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { useTelegram } from '@/hooks/use-telegram';
import { duelStart } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';
import type { Duel } from '@/types/api';

const TOTAL_QUESTIONS = 10;

export function DuelGame() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();
  const user = useUserStore((s) => s.user);
  const {
    duel,
    currentQuestion,
    questionIndex,
    answerFeedback,
    quizResult,
    isLoading,
    phase,
    winnerId,
    fetchDuel,
    startPolling,
    stopPolling,
    submitAnswer,
    startWaitingForOpponent,
    reset,
  } = useDuelStore();

  const answerStartTime = useRef(Date.now());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useBackButton(useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]));

  useEffect(() => {
    if (!id || !user) return;
    const duelId = Number(id);

    async function init() {
      // Загружаем текущее состояние дуэли
      await fetchDuel(duelId);
      const currentDuel = useDuelStore.getState().duel;
      if (!currentDuel) return;

      const isChallenger = currentDuel.challengerId === user!.id;

      // Оппонент — сначала присоединяется к дуэли
      if (!isChallenger && currentDuel.status === 'waiting') {
        await useDuelStore.getState().joinDuel(duelId);
      }

      // Стартуем квиз для существующей дуэльной сессии
      const res = await duelStart(duelId);
      useDuelStore.setState({
        sessionId: res.sessionId,
        currentQuestion: res.question,
        phase: 'playing',
      });
      setInitialized(true);
    }

    init();
    return () => reset();
  }, [id, user, fetchDuel, reset]);

  useEffect(() => {
    if (!id || !initialized) return;
    const duelId = Number(id);
    startPolling(duelId);
    return () => stopPolling();
  }, [id, initialized, startPolling, stopPolling]);

  useEffect(() => {
    if (currentQuestion) {
      answerStartTime.current = Date.now();
      setSelectedOption(null);
    }
  }, [currentQuestion]);

  useEffect(() => {
    if (!quizResult || !duel) return;
    const duelId = duel.id;
    const d = duel as Duel;

    const bothFinished = d.challengerSession?.finishedAt && d.opponentSession?.finishedAt;
    if (bothFinished || d.status === 'finished') {
      useDuelStore.getState().finishDuel().then(() => {
        useDuelStore.setState({ phase: 'finished' });
      });
    } else {
      startWaitingForOpponent(duelId);
    }
  }, [quizResult, duel?.id]);

  useEffect(() => {
    if (phase === 'finished' && duel && winnerId !== undefined) {
      navigate(`/duel/${duel.id}/result`, { replace: true });
    }
  }, [phase, duel, winnerId, navigate]);

  const handleAnswer = useCallback((option: string) => {
    if (answerFeedback || isLoading || !currentQuestion) return;

    hapticImpact('light');
    setSelectedOption(option);

    const timeMs = Date.now() - answerStartTime.current;
    const isCorrectGuess = option === currentQuestion.correctTranslation;

    submitAnswer(isCorrectGuess ? currentQuestion.meaningId : null, timeMs);
  }, [answerFeedback, isLoading, currentQuestion, hapticImpact, submitAnswer]);

  useEffect(() => {
    if (answerFeedback) {
      hapticNotification(answerFeedback.isCorrect ? 'success' : 'error');
    }
  }, [answerFeedback, hapticNotification]);

  const duelData = duel && 'challenger' in duel ? duel as Duel : null;
  const isChallenger = duelData && user ? duelData.challengerId === user.id : false;
  const opponentName = duelData
    ? (isChallenger ? duelData.opponent?.firstName : duelData.challenger?.firstName) ?? 'Оппонент'
    : 'Оппонент';
  const opponentSession = duelData
    ? (isChallenger ? duelData.opponentSession : duelData.challengerSession)
    : null;
  const opponentAnswered = opponentSession?.totalCount ?? 0;

  // Waiting for opponent screen
  if (phase === 'waiting_opponent') {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 pt-6 pb-8">
        <HugeiconsIcon icon={Loading03Icon} size={32} className="animate-spin text-[var(--brand-9)]" />
        <h2 className="mt-4 text-xl font-bold">Ожидание оппонента</h2>
        <p className="mt-2 text-center text-[var(--gray-11)]">
          {opponentName} ещё отвечает на вопросы...
        </p>
        <Card className="mt-6 w-full">
          <div className="flex items-center justify-between text-sm text-[var(--gray-11)]">
            <span>{opponentName}</span>
            <span>{opponentAnswered}/{TOTAL_QUESTIONS}</span>
          </div>
          <Progress value={(opponentAnswered / TOTAL_QUESTIONS) * 100} className="mt-2" />
        </Card>
        {quizResult && (
          <Card className="mt-3 w-full">
            <div className="text-center text-sm text-[var(--gray-11)]">Ваш результат</div>
            <div className="mt-1 text-center text-2xl font-bold">
              {quizResult.correctCount}/{quizResult.totalCount}
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (!initialized || (!currentQuestion && !answerFeedback)) {
    return (
      <div className="flex min-h-full flex-col gap-4 px-4 pt-6">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="mt-8 h-20 w-full rounded-2xl" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-4 pt-6 pb-8">
      {/* Back */}
      <div className="mb-4">
        <BackButton onClick={() => { reset(); navigate('/'); }} />
      </div>

      {/* Opponent progress */}
      <div className="mb-2 flex items-center justify-between text-sm text-[var(--gray-11)]">
        <span>vs {opponentName}</span>
        <span>{opponentAnswered}/{TOTAL_QUESTIONS}</span>
      </div>
      <Progress value={(opponentAnswered / TOTAL_QUESTIONS) * 100} className="mb-4 h-1.5 opacity-50" />

      {/* Your progress */}
      <div className="flex items-center gap-3">
        <Progress value={((questionIndex + 1) / TOTAL_QUESTIONS) * 100} className="flex-1" />
        <span className="text-sm font-medium text-[var(--gray-11)]">
          {questionIndex + 1}/{TOTAL_QUESTIONS}
        </span>
      </div>

      {/* Word */}
      <div className="mt-8 flex flex-1 flex-col items-center justify-center">
        <span className="text-sm text-[var(--gray-11)]">Как переводится?</span>
        <h2 className="mt-2 text-3xl font-bold">{currentQuestion?.word}</h2>
      </div>

      {/* Options 2x2 grid */}
      <div className="mt-auto grid grid-cols-2 gap-3 pb-4">
        {currentQuestion?.options.map((option) => {
          const isSelected = selectedOption === option;
          const showResult = answerFeedback !== null;
          const isCorrectOption = option === answerFeedback?.correctTranslation;

          return (
            <Button
              key={`${questionIndex}-${option}`}
              variant={
                !showResult ? 'secondary' :
                isCorrectOption ? 'success' :
                isSelected && !isCorrectOption ? 'error' :
                'secondary'
              }
              disabled={showResult || isLoading}
              onClick={() => handleAnswer(option)}
              className={cn(
                'px-4 text-center text-sm',
                showResult && !isSelected && !isCorrectOption && 'opacity-40',
              )}
            >
              {option}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
