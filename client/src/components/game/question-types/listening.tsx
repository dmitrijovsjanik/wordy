import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSpeech } from '@/hooks/use-speech';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon } from '@hugeicons/core-free-icons';
import type { AnswerFeedback } from '@/types/game';

type ListeningProps = {
  options: string[];
  questionKey: string | number;
  selectedAnswer: string | null;
  feedback: AnswerFeedback | null;
  disabled?: boolean;
  onAnswer: (answer: string) => void;
  onSkip?: () => void;
  showSkip?: boolean;
  audioWord: string;
  transcription?: string | null;
};

export function Listening({
  options,
  questionKey,
  selectedAnswer,
  feedback,
  disabled = false,
  onAnswer,
  onSkip,
  showSkip = true,
  audioWord,
  transcription,
}: ListeningProps) {
  const { speak, isSpeaking, isLoading } = useSpeech({ lang: 'en-US', rate: 0.85 });
  const hasPlayedRef = useRef(false);
  const showResult = feedback !== null;

  // Сброс при смене вопроса
  useEffect(() => {
    hasPlayedRef.current = false;
  }, [questionKey]);

  useEffect(() => {
    if (!hasPlayedRef.current && audioWord) {
      hasPlayedRef.current = true;
      const timer = setTimeout(() => speak(audioWord), 200);
      return () => clearTimeout(timer);
    }
  }, [audioWord, speak, questionKey]);

  const handleReplay = () => {
    if (!isSpeaking && !isLoading) {
      speak(audioWord);
    }
  };

  return (
    <>
      {/* Кнопка воспроизведения */}
      <div className="mb-4 flex items-center justify-center">
        <Button
          variant="secondary"
          size="icon-xs"
          onClick={handleReplay}
          disabled={isSpeaking || isLoading}
          className={cn(
            'transition-transform',
            (isSpeaking || isLoading) && 'animate-pulse',
          )}
        >
          <HugeiconsIcon icon={VolumeHighIcon} size={24} />
        </Button>
      </div>

      {/* Options grid 2x2 */}
      <div className="grid w-full grid-cols-2 gap-3">
        {options.map((option, idx) => {
          const isSelected = selectedAnswer === option;
          const isCorrectOption = option === feedback?.correctAnswer;
          const isWrongSelected = isSelected && !isCorrectOption;

          return (
            <Button
              key={`${questionKey}-${idx}`}
              variant={
                !showResult ? 'secondary' :
                isCorrectOption ? 'success' :
                isWrongSelected ? 'destructive' :
                'secondary'
              }
              disabled={(showResult && !isSelected && !isCorrectOption) || disabled}
              onClick={() => onAnswer(option)}
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
      {showSkip && onSkip && (
        <Button
          variant="link"
          size="sm"
          disabled={showResult || disabled}
          onClick={onSkip}
          className={cn(
            'mt-4 w-full',
            (showResult || disabled) && 'opacity-40',
          )}
        >
          Не знаю
        </Button>
      )}
    </>
  );
}
