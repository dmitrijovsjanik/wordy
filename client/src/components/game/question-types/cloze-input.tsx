import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick01Icon } from '@hugeicons/core-free-icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { checkAnswer, type AnswerResult } from '@/lib/answer-check';

type ClozeInputFeedback = {
  result: AnswerResult;
  correctAnswer: string;
};

type ClozeInputProps = {
  questionKey: string | number;
  sentence: string;        // "I need to _____ a decision"
  sentenceRu: string;
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
 * Cloze-input: предложение с пропуском, без вариантов.
 * Production-tier — контекстный recall. Стимул: английское предложение
 * с _____ + русский перевод как подсказка. Пользователь печатает
 * пропущенное слово.
 */
export function ClozeInput({
  questionKey,
  sentence,
  sentenceRu,
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

  const inputBorderClass = showResult
    ? activeFeedback.result === 'exact'
      ? 'border-[var(--green-9)]'
      : activeFeedback.result === 'close'
        ? 'border-[var(--amber-9)]'
        : 'border-[var(--red-9)]'
    : '';

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Английское предложение с пропуском (стимул). */}
      <Card className="flex flex-col gap-2 px-4 py-4">
        <div className="text-base text-[var(--gray-12)]">{sentence}</div>
        <div className="text-sm text-[var(--gray-11)]">{sentenceRu}</div>
      </Card>

      {/* Инпут + подтверждение. */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          key={`input-${questionKey}`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type the missing word..."
          disabled={showResult || disabled}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn('flex-1 border transition-colors', inputBorderClass)}
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

      <AnimatePresence mode="wait">
        {showResult && (
          <motion.div
            key={`feedback-${questionKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'rounded-xl px-4 py-3 text-center text-sm font-medium',
              activeFeedback.result === 'exact' && 'bg-[var(--green-3)] text-[var(--green-11)]',
              activeFeedback.result === 'close' && 'bg-[var(--amber-3)] text-[var(--amber-11)]',
              activeFeedback.result === 'wrong' && 'bg-[var(--red-3)] text-[var(--red-11)]',
            )}
          >
            {activeFeedback.result === 'exact' && 'Верно!'}
            {activeFeedback.result === 'close' && 'Почти! Засчитано.'}
            {activeFeedback.result === 'wrong' && (
              <>
                <div>Неверно</div>
                <div className="mt-1 text-base font-bold">{activeFeedback.correctAnswer}</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
