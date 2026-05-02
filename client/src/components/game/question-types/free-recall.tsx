import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { checkAnswer, type AnswerResult } from '@/lib/answer-check';
import { useSpeech } from '@/hooks/use-speech';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon, Tick01Icon } from '@hugeicons/core-free-icons';

type FreeRecallFeedback = {
  result: AnswerResult;
  correctAnswer: string;
};

type FreeRecallProps = {
  questionKey: string | number;
  prompt: string;
  direction: 'en-ru' | 'ru-en';
  transcription: string | null;
  audioWord?: string;
  acceptableAnswers: string[];
  feedback: FreeRecallFeedback | null;
  disabled?: boolean;
  meaningId: number;
  onAnswer: (meaningId: number | null) => void;
  onTextSubmit?: (text: string) => void;
  onSkip?: () => void;
  showSkip?: boolean;
};

export function FreeRecall({
  questionKey,
  direction,
  audioWord,
  acceptableAnswers,
  feedback,
  disabled = false,
  meaningId,
  onAnswer,
  onTextSubmit,
  onSkip,
  showSkip = true,
}: FreeRecallProps) {
  const [inputValue, setInputValue] = useState('');
  const [localFeedback, setLocalFeedback] = useState<FreeRecallFeedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak } = useSpeech();

  // Совмещённый feedback (локальный или от родителя)
  const activeFeedback = feedback ?? localFeedback;
  const showResult = activeFeedback !== null;

  // Сбрасываем состояние при смене вопроса
  useEffect(() => {
    setInputValue('');
    setLocalFeedback(null);
    // Автофокус на инпут при новом вопросе
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [questionKey]);

  function handleSubmit() {
    if (showResult || disabled || !inputValue.trim()) return;

    onTextSubmit?.(inputValue.trim());

    const result = checkAnswer(inputValue, acceptableAnswers);
    const correctAnswer = acceptableAnswers[0] ?? '';

    setLocalFeedback({ result, correctAnswer });

    // exact или close — считаем правильным, передаём meaningId
    if (result === 'exact' || result === 'close') {
      onAnswer(meaningId);
    } else {
      onAnswer(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSpeak() {
    if (audioWord) {
      speak(audioWord);
    }
  }

  // Цвет обводки инпута по результату
  const inputBorderClass = showResult
    ? activeFeedback.result === 'exact'
      ? 'border-[var(--green-9)]'
      : activeFeedback.result === 'close'
        ? 'border-[var(--amber-9)]'
        : 'border-[var(--red-9)]'
    : '';

  // Текст подсказки для инпута
  const placeholder = direction === 'en-ru'
    ? 'Введите перевод...'
    : 'Type the word...';

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Кнопка произношения (только для en→ru) */}
      {direction === 'en-ru' && audioWord && (
        <div className="flex justify-center">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleSpeak}
            className="text-[var(--brand-9)]"
          >
            <HugeiconsIcon icon={VolumeHighIcon} size={22} strokeWidth={2} />
          </Button>
        </div>
      )}

      {/* Инпут с кнопкой подтверждения */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          key={`input-${questionKey}`}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={showResult || disabled}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            'flex-1 border transition-colors',
            inputBorderClass,
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

      {/* Результат */}
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
                <div className="mt-1 text-base font-bold">
                  {activeFeedback.correctAnswer}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Кнопка пропуска */}
      {showSkip && onSkip && (
        <Button
          variant="link"
          size="sm"
          disabled={showResult || disabled}
          onClick={onSkip}
          className={cn(
            'w-full',
            (showResult || disabled) && 'opacity-40',
          )}
        >
          Не знаю
        </Button>
      )}
    </div>
  );
}

export type { FreeRecallFeedback, FreeRecallProps };
