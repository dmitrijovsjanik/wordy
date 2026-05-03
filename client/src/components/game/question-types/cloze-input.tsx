import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick01Icon } from '@hugeicons/core-free-icons';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BlankSentence } from '@/components/game/blank-sentence';
import { cn } from '@/lib/utils';
import { checkAnswer, type AnswerResult } from '@/lib/answer-check';

type ClozeInputFeedback = {
  result: AnswerResult;
  correctAnswer: string;
};

type ClozeInputProps = {
  questionKey: string | number;
  /** Английское предложение с _____ */
  sentence: string;
  /** Русский перевод полного предложения (показывается после ответа). */
  sentenceRu: string;
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
 * Cloze-input — production-tier (L4) на главной.
 *
 * Дизайн взят из CollocationQuiz: предложение с пропуском крупным
 * Unbounded-шрифтом + русский перевод снизу как фидбек. Отличие — вместо
 * 2×2 сетки вариантов используется инпут.
 *
 * После сабмита: пропуск заполняется правильным ответом (зелёным если
 * пользователь был прав, красным — если ошибся), появляется перевод,
 * через ~1.2с (через стор) — следующий вопрос.
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

  // Состояние пропуска: пустой → синий, после ответа → зелёный/красный.
  const blankState = !showResult
    ? 'empty'
    : activeFeedback.result === 'wrong'
      ? 'wrong'
      : 'correct';

  // После ответа в пропуск подставляем правильный ответ (как в collocation-quiz),
  // чтобы пользователь сразу видел нужное слово в контексте.
  const filledValues = showResult ? [activeFeedback.correctAnswer] : undefined;

  return (
    <div className="flex flex-1 flex-col">
      {/* Предложение с пропуском — крупный шрифт по центру (как collocation). */}
      <div className="mb-6 text-center text-2xl font-[Unbounded] font-bold leading-tight">
        <BlankSentence
          text={sentence}
          filledValues={filledValues}
          blankState={blankState}
        />
      </div>

      {/* Русский перевод появляется после ответа (как в collocation-quiz). */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            key="translation"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="mb-4 text-center text-sm text-[var(--gray-11)]"
          >
            {sentenceRu}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Инпут + сабмит вместо 2×2 сетки опций. */}
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
          className={cn('mt-3 w-full', (showResult || disabled) && 'opacity-40')}
        >
          Не знаю
        </Button>
      )}
    </div>
  );
}

export type { ClozeInputFeedback, ClozeInputProps };
