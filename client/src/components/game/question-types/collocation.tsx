import { Button } from '@/components/ui/button';
import { BlankSentence } from '@/components/game/blank-sentence';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type CollocationType = 'verb_noun' | 'adj_noun' | 'adv_adj';

type CollocationData = {
  blank: string;
  correctAnswer: string;
  options: string[];
  type: CollocationType;
  translation: string;
  difficulty: 1 | 2 | 3;
};

type CollocationFeedback = {
  isCorrect: boolean;
  correctAnswer: string;
  translation: string;
};

type CollocationProps = {
  collocation: CollocationData;
  questionKey: string | number;
  selectedAnswer: string | null;
  feedback: CollocationFeedback | null;
  disabled?: boolean;
  onAnswer: (answer: string) => void;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CollocationType, string> = {
  verb_noun: 'глагол + существительное',
  adj_noun: 'прилагательное + существительное',
  adv_adj: 'наречие + прилагательное',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function Collocation({
  collocation,
  questionKey,
  selectedAnswer,
  feedback,
  disabled = false,
  onAnswer,
}: CollocationProps) {
  const showResult = feedback !== null;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      {/* Тип коллокации */}
      <span className="text-xs text-[var(--gray-11)]">
        {TYPE_LABELS[collocation.type]}
      </span>

      {/* Фраза с пропуском */}
      <div className="text-center text-xl font-semibold">
        <BlankSentence
          text={collocation.blank}
          filledValues={showResult ? [feedback.correctAnswer] : undefined}
          blankState={showResult ? (feedback.isCorrect ? 'correct' : 'wrong') : 'empty'}
        />
      </div>

      {/* Перевод (после ответа) */}
      {showResult && (
        <div className="text-center text-sm text-[var(--gray-11)]">
          {feedback.translation}
        </div>
      )}

      {/* Варианты 2x2 */}
      <div className="grid w-full grid-cols-2 gap-3">
        {collocation.options.map((option, idx) => {
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
    </div>
  );
}
