import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AnswerFeedback } from '@/types/game';

type MultipleChoiceProps = {
  options: string[];
  questionKey: string | number; // Для уникальных key кнопок
  selectedAnswer: string | null;
  feedback: AnswerFeedback | null;
  disabled?: boolean;
  onAnswer: (answer: string) => void;
  onSkip?: () => void;
  showSkip?: boolean;
};

export function MultipleChoice({
  options,
  questionKey,
  selectedAnswer,
  feedback,
  disabled = false,
  onAnswer,
  onSkip,
  showSkip = true,
}: MultipleChoiceProps) {
  const showResult = feedback !== null;

  return (
    <>
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
                // Подсветка правильного ответа зелёным если пользователь ошибся
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
          Пропустить
        </Button>
      )}
    </>
  );
}
