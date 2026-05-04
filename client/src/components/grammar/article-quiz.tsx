import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { BlankSentence } from '@/components/game/blank-sentence';
import { cn } from '@/lib/utils';
import { getNextArticleExercise, submitArticleAnswer } from '@/lib/api';
import type { ArticleExercise, ArticleAnswer } from '@/types/grammar';

const ARTICLE_OPTIONS: ArticleAnswer[] = ['a', 'an', 'the', '—'];

type FeedbackState = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation: string;
} | null;

type ArticleQuizProps = {
  difficulty?: 1 | 2 | 3;
  onSwitchView?: () => void;
};

export function ArticleQuiz({ difficulty, onSwitchView }: ArticleQuizProps) {
  const [exercise, setExercise] = useState<ArticleExercise | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const loadNextQuestion = useCallback(async () => {
    try {
      setError(null);
      const result = await getNextArticleExercise(difficulty);
      setExercise(result.exercise);
      setExerciseIndex(result.exerciseIndex);
      setSelectedAnswer(null);
      setFeedback(null);
      setIsFirstLoad(false);
    } catch {
      setError('Не удалось загрузить вопрос. Попробуйте ещё раз.');
    }
  }, [difficulty]);

  useEffect(() => {
    void loadNextQuestion();
  }, [loadNextQuestion]);

  const handleAnswer = useCallback(async (answer: ArticleAnswer) => {
    if (feedback || !exercise) return;

    setSelectedAnswer(answer);

    try {
      const result = await submitArticleAnswer({
        exerciseIndex,
        blankIndex: 0,
        answer,
      });

      setFeedback({
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
      });

      // User clicks "Далее" button to proceed
    } catch {
      setError('Не удалось отправить ответ. Попробуйте ещё раз.');
      setSelectedAnswer(null);
    }
  }, [feedback, exercise, exerciseIndex, loadNextQuestion]);

  if (isFirstLoad && !exercise) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <div className="text-sm text-[var(--gray-11)]">Загрузка...</div>
      </div>
    );
  }

  if (error && !exercise) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-sm text-[var(--red-11)]">{error}</p>
        <Button variant="secondary" onClick={() => void loadNextQuestion()}>
          Попробовать снова
        </Button>
      </div>
    );
  }

  if (!exercise) return null;

  // Determine blank display value and state
  const displayAnswer = feedback
    ? (feedback.correctAnswer === '—' ? '\u2014' : feedback.correctAnswer)
    : selectedAnswer
      ? (selectedAnswer === '—' ? '\u2014' : selectedAnswer)
      : undefined;
  const blankState = feedback
    ? (feedback.isCorrect ? 'correct' as const : 'wrong' as const)
    : 'empty' as const;

  return (
    <div className="flex flex-1 flex-col gap-6 px-4 pt-4">
      {/* Rule category badge + reference button */}
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-[var(--gray-3)] px-3 py-1 text-xs text-[var(--gray-11)]">
          {exercise.rule}
        </span>
        {onSwitchView && (
          <Button
            variant="ghost"
            size="compact"
            onClick={onSwitchView}
            className="gap-1.5 text-[var(--brand-11)]"
          >
            <HugeiconsIcon icon={BookOpen02Icon} size={16} />
            Справочник
          </Button>
        )}
      </div>

      {/* Sentence with blank */}
      <AnimatePresence mode="wait">
        <motion.div
          key={exerciseIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 items-center justify-center"
        >
          <p className="text-center text-2xl font-[Unbounded] font-bold leading-tight">
            <BlankSentence
              text={exercise.sentence}
              filledValues={displayAnswer ? [displayAnswer] : undefined}
              blankState={blankState}
            />
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Explanation card (after answering) */}
      {feedback && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'rounded-xl px-4 py-3',
            feedback.isCorrect ? 'bg-[var(--green-3)]' : 'bg-[var(--red-3)]',
          )}
        >
          <p className={cn(
            'mb-1 text-sm font-semibold',
            feedback.isCorrect ? 'text-[var(--green-11)]' : 'text-[var(--red-11)]',
          )}>
            {feedback.isCorrect ? 'Правильно!' : `Правильный ответ: ${feedback.correctAnswer === '—' ? '\u2014 (без артикля)' : feedback.correctAnswer}`}
          </p>
          <p className="text-sm text-[var(--gray-11)]">
            {feedback.explanation}
          </p>
        </motion.div>
      )}

      {/* Next button */}
      {feedback && (
        <Button onClick={() => void loadNextQuestion()} className="w-full">
          Далее
        </Button>
      )}

      {/* Answer buttons — 4 in a row */}
      <div className="grid grid-cols-4 gap-3 pb-6">
        {ARTICLE_OPTIONS.map((option) => {
          const isSelected = selectedAnswer === option;
          const isCorrectOption = feedback?.correctAnswer === option;
          const isWrongSelected = isSelected && !isCorrectOption && feedback !== null;
          const showResult = feedback !== null;

          return (
            <Button
              key={option}
              variant={
                !showResult ? 'secondary' :
                isCorrectOption ? 'success' :
                isWrongSelected ? 'destructive' :
                'secondary'
              }
              disabled={showResult}
              onClick={() => void handleAnswer(option)}
              className={cn(
                'h-14 text-base font-semibold',
                showResult && 'pointer-events-none',
                showResult && isCorrectOption && !feedback?.isCorrect && 'bg-[var(--green-3)] text-[var(--green-12)]',
              )}
            >
              {option === '—' ? '\u2014' : option}
            </Button>
          );
        })}
      </div>

      {/* Error toast */}
      {error && (
        <div className="rounded-xl bg-[var(--red-3)] px-4 py-3 text-center text-sm text-[var(--red-11)]">
          {error}
        </div>
      )}
    </div>
  );
}
