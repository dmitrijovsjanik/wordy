import { useEffect, useCallback, useState } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { platformBridge } from '@/lib/platform-bridge';
import { cn } from '@/lib/utils';
import type { AnswerFeedback } from '@/types/game';

export function QuizStep() {
  const currentQuestion = useOnboardingStore((s) => s.currentQuestion);
  const questionNumber = useOnboardingStore((s) => s.questionNumber);
  const totalQuestions = useOnboardingStore((s) => s.totalQuestions);
  const isAnswered = useOnboardingStore((s) => s.isAnswered);
  const lastAnswerCorrect = useOnboardingStore((s) => s.lastAnswerCorrect);
  const isLoading = useOnboardingStore((s) => s.isLoading);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // Telegram integration: disable swipes and enable closing confirmation
  useEffect(() => {
    telegram.disableVerticalSwipes();
    telegram.enableClosingConfirmation();
    return () => {
      telegram.disableClosingConfirmation();
    };
  }, []);

  // Haptic feedback on answer
  useEffect(() => {
    if (lastAnswerCorrect === null) return;
    if (lastAnswerCorrect) {
      platformBridge.hapticNotification('success');
    } else {
      platformBridge.hapticNotification('error');
    }
  }, [lastAnswerCorrect]);

  // Reset selected answer on new question
  useEffect(() => {
    if (currentQuestion) {
      setSelectedAnswer(null);
    }
  }, [currentQuestion]);

  const handleAnswer = useCallback((option: string) => {
    if (isAnswered || isLoading) return;
    setSelectedAnswer(option);
    useOnboardingStore.getState().submitAnswer(option);
  }, [isAnswered, isLoading]);

  const handleSkip = useCallback(() => {
    if (isAnswered || isLoading || !currentQuestion) return;
    useOnboardingStore.getState().submitAnswer('');
  }, [isAnswered, isLoading, currentQuestion]);

  if (!currentQuestion) return null;

  // Build feedback for MultipleChoice-style rendering
  const feedback: AnswerFeedback | null = lastAnswerCorrect !== null
    ? {
        isCorrect: lastAnswerCorrect,
        correctAnswer: currentQuestion.correctTranslation,
      }
    : null;

  const showResult = feedback !== null;

  return (
    <div className="flex min-h-dvh flex-col px-4">
      {/* Progress area */}
      <div className="pt-4">
        <p className="text-right text-xs text-[var(--gray-10)]">
          {questionNumber} из {totalQuestions}
        </p>
        <Progress
          value={((questionNumber - 1) / totalQuestions) * 100}
          className="mt-1 h-2"
        />
      </div>

      {/* Word display */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="font-[Unbounded] font-bold text-[var(--gray-12)]" style={{ fontSize: 'clamp(1.75rem, 10vw, 2.25rem)' }}>
          {currentQuestion.word}
        </p>
        {currentQuestion.transcription && (
          <p className="mt-1 text-sm text-[var(--gray-10)]">
            {currentQuestion.transcription}
          </p>
        )}
      </div>

      {/* Options grid 2x2 — same as main quiz */}
      <div className="shrink-0 pb-8">
        <div className="grid w-full grid-cols-2 gap-3">
          {currentQuestion.options.map((option, idx) => {
            const isSelected = selectedAnswer === option;
            const isCorrectOption = option === currentQuestion.correctTranslation;
            const isWrongSelected = isSelected && !isCorrectOption;

            return (
              <Button
                key={`${currentQuestion.meaningId}-${idx}`}
                variant={
                  !showResult ? 'secondary' :
                  isCorrectOption ? 'success' :
                  isWrongSelected ? 'destructive' :
                  'secondary'
                }
                disabled={(showResult && !isSelected && !isCorrectOption) || isLoading}
                onClick={() => handleAnswer(option)}
                className={cn(
                  'h-auto min-h-14 whitespace-normal px-4 py-2 text-center text-sm leading-tight',
                  showResult && 'pointer-events-none',
                  showResult && isCorrectOption && !feedback?.isCorrect && 'bg-[var(--green-3)] text-[var(--green-12)]',
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
          disabled={showResult || isLoading}
          onClick={handleSkip}
          className={cn(
            'mt-4 w-full',
            (showResult || isLoading) && 'opacity-40',
          )}
        >
          Пропустить
        </Button>
      </div>
    </div>
  );
}
