import { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick01Icon } from '@hugeicons/core-free-icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { checkAnswer, type AnswerResult } from '@/lib/answer-check';

type ClozeInputFeedback = {
  result: AnswerResult;
  correctAnswer: string;
};

type ClozeInputProps = {
  questionKey: string | number;
  /** Допустимые варианты для проверки. */
  acceptableAnswers: string[];
  feedback: ClozeInputFeedback | null;
  disabled?: boolean;
  meaningId: number;
  onAnswer: (meaningId: number | null) => void;
  onTextSubmit?: (text: string) => void;
  onSkip?: () => void;
  showSkip?: boolean;
};

/**
 * Cloze-input — production-tier (L4): инпут + кнопка submit.
 *
 * Стимул (BlankSentence + перевод) рендерится в верхней stimulus-области
 * home.tsx и заполняется по результату валидации. Здесь только форма ввода
 * — чтобы инпут был прибит к низу как у L3 free-recall.
 */
export function ClozeInput({
  questionKey,
  acceptableAnswers,
  feedback,
  disabled = false,
  meaningId,
  onAnswer,
  onTextSubmit,
  onSkip,
  showSkip = true,
}: ClozeInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [localFeedback, setLocalFeedback] = useState<ClozeInputFeedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeFeedback = feedback ?? localFeedback;
  const showResult = activeFeedback !== null;

  useEffect(() => {
    setInputValue('');
    setLocalFeedback(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [questionKey]);

  function handleSubmit() {
    if (showResult || disabled || !inputValue.trim()) return;
    onTextSubmit?.(inputValue.trim());

    const result = checkAnswer(inputValue, acceptableAnswers);
    const correctAnswer = acceptableAnswers[0] ?? '';
    setLocalFeedback({ result, correctAnswer });

    onAnswer(result === 'exact' || result === 'close' ? meaningId : null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          key={`input-${questionKey}`}
          value={showResult ? activeFeedback.correctAnswer : inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите слово..."
          disabled={showResult || disabled}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            'flex-1 border transition-colors',
            showResult && activeFeedback.result === 'exact' && 'border-[var(--green-9)]',
            showResult && activeFeedback.result === 'close' && 'border-[var(--amber-9)]',
            showResult && activeFeedback.result === 'wrong' && 'border-[var(--red-9)]',
          )}
        />
        <Button
          onClick={handleSubmit}
          disabled={showResult || disabled || !inputValue.trim()}
          className="shrink-0"
          size="icon"
        >
          <HugeiconsIcon icon={Tick01Icon} size={20} />
        </Button>
      </div>

      {showSkip && onSkip && (
        <Button
          variant="link"
          size="sm"
          disabled={showResult || disabled}
          onClick={onSkip}
          className={cn('w-full', (showResult || disabled) && 'opacity-40')}
        >
          Не знаю
        </Button>
      )}
    </div>
  );
}

export type { ClozeInputFeedback, ClozeInputProps };
