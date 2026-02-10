import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getNextFalseFriend, submitFalseFriendAnswer } from '@/lib/api';
import type { FalseFriendQuestion, FalseFriendAnswerResult } from '@/types/grammar';

const AUTO_ADVANCE_DELAY = 2000;

export function FalseFriendsQuiz() {
  const [question, setQuestion] = useState<FalseFriendQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [result, setResult] = useState<FalseFriendAnswerResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadNext = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getNextFalseFriend();
      setQuestion(res.question);
      setSelectedAnswer(null);
      setResult(null);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNext();
  }, [loadNext]);

  const handleAnswer = useCallback(async (answer: string) => {
    if (!question || selectedAnswer) return;
    setSelectedAnswer(answer);
    setIsLoading(true);

    try {
      const res = await submitFalseFriendAnswer(question.questionIndex, answer);
      setResult(res);

      setTimeout(() => {
        loadNext();
      }, AUTO_ADVANCE_DELAY);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [question, selectedAnswer, loadNext]);

  if (!question) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-[var(--gray-11)]">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.questionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col"
        >
          {/* Word */}
          <div className="mb-6 text-center">
            <p className="font-[Unbounded] font-bold text-[var(--gray-12)]" style={{ fontSize: 'clamp(1.75rem, 10vw, 2.25rem)' }}>{question.word}</p>
            <p className="mt-1 text-sm text-[var(--gray-11)]">Выберите правильный перевод</p>
          </div>

          {/* Options 2x2 */}
          <div className="grid grid-cols-2 gap-3">
            {question.options.map((option, idx) => {
              const showResult = result !== null;
              const isSelected = selectedAnswer === option;
              const isCorrectOption = result && option === result.correctAnswer;
              const isWrongSelected = isSelected && !isCorrectOption;
              const isWrongFriend = result && option === result.wrongFriend && !isCorrectOption;

              return (
                <Button
                  key={`${question.questionIndex}-${idx}`}
                  variant={
                    !showResult ? 'secondary' :
                    isCorrectOption ? 'success' :
                    isWrongSelected ? 'destructive' :
                    'secondary'
                  }
                  disabled={showResult || isLoading}
                  onClick={() => handleAnswer(option)}
                  className={cn(
                    'h-auto min-h-14 whitespace-normal px-4 py-2 text-center text-sm leading-tight',
                    showResult && 'pointer-events-none',
                    showResult && isCorrectOption && !result?.isCorrect && 'bg-[var(--green-3)] text-[var(--green-12)]',
                    showResult && isWrongFriend && 'border-[var(--orange-8)] bg-[var(--orange-3)] text-[var(--orange-11)]',
                  )}
                >
                  {option}
                </Button>
              );
            })}
          </div>

          {/* Feedback */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`mt-4 rounded-xl p-4 ${
                  result.isCorrect ? 'bg-[var(--green-3)]' : 'bg-[var(--red-3)]'
                }`}
              >
                <p className={`text-sm font-medium ${
                  result.isCorrect ? 'text-[var(--green-11)]' : 'text-[var(--red-11)]'
                }`}>
                  {result.explanation}
                </p>
                <p className="mt-2 text-xs text-[var(--gray-11)]">
                  {question.example}
                </p>
                <p className="text-xs text-[var(--gray-10)]">
                  {question.exampleRu}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
