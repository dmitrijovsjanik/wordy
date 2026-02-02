import { useEffect, useRef, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon } from '@hugeicons/core-free-icons';
import { useGameStore } from '@/stores/game-store';
import { useUserStore } from '@/stores/user-store';
import { useBackButton } from '@/hooks/use-back-button';
import { useTelegram } from '@/hooks/use-telegram';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { cn } from '@/lib/utils';

export function Quiz() {
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();
  const user = useUserStore((s) => s.user);
  const {
    currentQuestion,
    questionIndex,
    isLoading,
    answerFeedback,
    result,
    startQuiz,
    submitAnswer,
    reset,
  } = useGameStore();

  const answerStartTime = useRef(Date.now());
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  useBackButton(useCallback(() => {
    reset();
    navigate('/');
  }, [reset, navigate]));

  useEffect(() => {
    startQuiz();
    return () => reset();
  }, [startQuiz, reset]);

  useEffect(() => {
    if (currentQuestion) {
      answerStartTime.current = Date.now();
      setSelectedOption(null);
    }
  }, [currentQuestion]);

  useEffect(() => {
    if (result) {
      navigate('/quiz/result', { replace: true });
    }
  }, [result, navigate]);

  const handleAnswer = useCallback((option: string) => {
    if (answerFeedback || isLoading || !currentQuestion) return;

    hapticImpact('light');
    setSelectedOption(option);

    const timeMs = Date.now() - answerStartTime.current;
    const isCorrectGuess = option === currentQuestion.correctTranslation;

    submitAnswer(
      isCorrectGuess ? currentQuestion.meaningId : null,
      timeMs,
    );
  }, [answerFeedback, isLoading, currentQuestion, hapticImpact, submitAnswer]);

  const handleSkip = useCallback(() => {
    if (answerFeedback || isLoading || !currentQuestion) return;

    hapticImpact('light');
    setSelectedOption(null);

    const timeMs = Date.now() - answerStartTime.current;
    submitAnswer(null, timeMs);
  }, [answerFeedback, isLoading, currentQuestion, hapticImpact, submitAnswer]);

  useEffect(() => {
    if (answerFeedback) {
      if (answerFeedback.isCorrect) {
        hapticNotification('success');
      } else {
        hapticNotification('error');
      }
    }
  }, [answerFeedback, hapticNotification]);

  if (!currentQuestion && !answerFeedback) {
    return (
      <div className="flex min-h-full flex-col items-center p-4">
        <Skeleton className="mt-6 h-7 w-48" />
        <Skeleton className="mt-24 h-10 w-56" />
        <Skeleton className="mt-3 h-5 w-28" />
        <div className="mt-auto grid w-full grid-cols-2 gap-3 pb-6">
          <Skeleton className="h-14 rounded-full" />
          <Skeleton className="h-14 rounded-full" />
          <Skeleton className="h-14 rounded-full" />
          <Skeleton className="h-14 rounded-full" />
        </div>
      </div>
    );
  }

  const question = currentQuestion;

  return (
    <div className="flex min-h-full flex-col items-center px-4 pt-6 pb-8">
      {/* Back */}
      <div className="w-full">
        <BackButton onClick={() => { reset(); navigate('/'); }} />
      </div>

      {/* Greeting */}
      <h1 className="mt-4 text-lg font-semibold">
        Привет, {user?.firstName ?? 'друг'} 🖐
      </h1>

      {/* Word + direction hint */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <span className="mb-2 text-xs text-[var(--gray-11)]">
          {question?.direction === 'ru-en' ? 'Переведите на английский' : 'Переведите на русский'}
        </span>
        <h2 className="text-4xl font-bold">{question?.word}</h2>
      </div>

      {/* Listen button — only for English words */}
      {question?.direction === 'en-ru' && (
        <Button variant="ghost" size="sm" className="mb-6" disabled>
          <HugeiconsIcon strokeWidth={2} icon={VolumeHighIcon} size={20} />
          Прослушать
        </Button>
      )}

      {/* Options grid 2x2 */}
      <div className="grid w-full grid-cols-2 gap-3">
        {question?.options.map((option) => {
          const isSelected = selectedOption === option;
          const showResult = answerFeedback !== null;
          const isCorrectOption = option === answerFeedback?.correctTranslation;
          const isWrongSelected = isSelected && !isCorrectOption;

          return (
            <Button
              key={`${questionIndex}-${option}`}
              variant={
                !showResult ? 'secondary' :
                isCorrectOption ? 'success' :
                isWrongSelected ? 'destructive' :
                'secondary'
              }
              disabled={showResult && !isSelected && !isCorrectOption}
              onClick={() => handleAnswer(option)}
              className={cn(
                'px-4 text-center text-sm',
                showResult && 'pointer-events-none',
                showResult && isCorrectOption && !answerFeedback?.isCorrect && 'bg-[var(--green-3)] text-[var(--green-12)]',
              )}
            >
              {option}
            </Button>
          );
        })}
      </div>

      {/* Skip button */}
      <Button
        variant="link"
        size="sm"
        disabled={answerFeedback !== null || isLoading}
        onClick={handleSkip}
        className={cn(
          'mt-5',
          (answerFeedback !== null || isLoading) && 'opacity-40',
        )}
      >
        Не знаю
      </Button>
    </div>
  );
}
