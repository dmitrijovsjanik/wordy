import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSpeech } from '@/hooks/use-speech';
import { levenshtein } from '@/lib/levenshtein';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon, Tick01Icon } from '@hugeicons/core-free-icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { AnswerFeedback } from '@/types/game';

type DictationFeedbackState = {
  type: 'exact' | 'close' | 'wrong';
  correctAnswer: string;
};

type DictationProps = {
  questionKey: string | number;
  audioWord: string;
  hint: string;
  correctAnswer: string;
  acceptableAnswers: string[];
  feedback: AnswerFeedback | null;
  disabled?: boolean;
  onAnswer: (selectedMeaningId: number | null) => void;
  onTextSubmit?: (text: string) => void;
  onSkip?: () => void;
  showSkip?: boolean;
  meaningId: number;
};

export function Dictation({
  questionKey,
  audioWord,
  hint,
  correctAnswer,
  acceptableAnswers,
  feedback,
  disabled = false,
  onAnswer,
  onTextSubmit,
  onSkip,
  showSkip = true,
  meaningId,
}: DictationProps) {
  const [inputValue, setInputValue] = useState('');
  const [localFeedback, setLocalFeedback] = useState<DictationFeedbackState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasPlayedRef = useRef(false);
  const { speak, isSpeaking, isLoading } = useSpeech({ lang: 'en-US', rate: 0.85 });

  const showResult = feedback !== null;

  // Сброс состояния при смене вопроса
  useEffect(() => {
    setInputValue('');
    setLocalFeedback(null);
    hasPlayedRef.current = false;
  }, [questionKey]);

  // Автовоспроизведение при монтировании / смене вопроса
  useEffect(() => {
    if (!hasPlayedRef.current && audioWord) {
      hasPlayedRef.current = true;
      const timer = setTimeout(() => speak(audioWord), 200);
      return () => clearTimeout(timer);
    }
  }, [audioWord, speak, questionKey]);

  // Фокус на инпут при смене вопроса
  useEffect(() => {
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);
    return () => clearTimeout(timer);
  }, [questionKey]);

  const handleReplay = () => {
    if (!isSpeaking && !isLoading) {
      speak(audioWord);
    }
  };

  const checkAnswer = useCallback((userInput: string) => {
    const trimmed = userInput.trim().toLowerCase();
    if (!trimmed) return;

    onTextSubmit?.(userInput.trim());

    // Проверка точного совпадения
    const isExact = acceptableAnswers.some(
      (ans) => ans.toLowerCase() === trimmed,
    );
    if (isExact) {
      setLocalFeedback({ type: 'exact', correctAnswer });
      onAnswer(meaningId);
      return;
    }

    // Проверка близкого совпадения (Levenshtein distance = 1)
    const isClose = acceptableAnswers.some(
      (ans) => levenshtein(ans.toLowerCase(), trimmed) === 1,
    );
    if (isClose) {
      setLocalFeedback({ type: 'close', correctAnswer });
      onAnswer(meaningId);
      return;
    }

    // Неправильный ответ
    setLocalFeedback({ type: 'wrong', correctAnswer });
    onAnswer(null);
  }, [acceptableAnswers, correctAnswer, meaningId, onAnswer, onTextSubmit]);

  const handleSubmit = useCallback(() => {
    if (showResult || disabled || localFeedback) return;
    checkAnswer(inputValue);
  }, [inputValue, showResult, disabled, localFeedback, checkAnswer]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Стили инпута в зависимости от результата
  const inputBorderClass = localFeedback
    ? localFeedback.type === 'exact'
      ? 'border-[var(--green-9)] text-[var(--green-11)]'
      : localFeedback.type === 'close'
        ? 'border-[var(--amber-9)] text-[var(--amber-11)]'
        : 'border-[var(--red-9)] text-[var(--red-11)]'
    : '';

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Кнопка воспроизведения */}
      <div className="flex justify-center">
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

      {/* Инпут + кнопка в одну строку */}
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Введите слово..."
          disabled={showResult || disabled || !!localFeedback}
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
          disabled={showResult || disabled || !!localFeedback || !inputValue.trim()}
          className="shrink-0"
          size="icon"
        >
          <HugeiconsIcon icon={Tick01Icon} size={20} />
        </Button>
      </div>

      {/* Результат */}
      <AnimatePresence mode="wait">
        {localFeedback && (
          <motion.div
            key={`feedback-${questionKey}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'rounded-xl px-4 py-3 text-center text-sm font-medium',
              localFeedback.type === 'exact' && 'bg-[var(--green-3)] text-[var(--green-11)]',
              localFeedback.type === 'close' && 'bg-[var(--amber-3)] text-[var(--amber-11)]',
              localFeedback.type === 'wrong' && 'bg-[var(--red-3)] text-[var(--red-11)]',
            )}
          >
            {localFeedback.type === 'exact' && 'Верно!'}
            {localFeedback.type === 'close' && (
              <>Почти! Правильно: <span className="font-bold">{localFeedback.correctAnswer}</span></>
            )}
            {localFeedback.type === 'wrong' && (
              <>
                <div>Неверно</div>
                <div className="mt-1 text-base font-bold">{localFeedback.correctAnswer}</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip button */}
      {showSkip && onSkip && !localFeedback && (
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
          Пропустить
        </Button>
      )}
    </div>
  );
}
