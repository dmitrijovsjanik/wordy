import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BlankSentence } from '@/components/game/blank-sentence';
import { cn } from '@/lib/utils';
import { getNextCollocationExercise, submitCollocationAnswer } from '@/lib/api';
import type { CollocationData, CollocationType } from '@/types/grammar';

const AUTO_ADVANCE_DELAY = 1500;

const TYPE_LABELS: Record<CollocationType, string> = {
  verb_noun: 'глагол + существительное',
  adj_noun: 'прилагательное + существительное',
  adv_adj: 'наречие + прилагательное',
};

type FeedbackState = {
  isCorrect: boolean;
  correctAnswer: string;
  translation: string;
} | null;

export function CollocationQuiz() {
  const [collocation, setCollocation] = useState<CollocationData | null>(null);
  const [collocationIndex, setCollocationIndex] = useState<number>(0);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const loadNextQuestion = useCallback(async () => {
    try {
      const res = await getNextCollocationExercise();
      setCollocation(res.collocation);
      setCollocationIndex(res.collocationIndex);
      setFeedback(null);
      setSelectedAnswer(null);
    } catch {
      setTimeout(loadNextQuestion, 1000);
    }
  }, []);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadNextQuestion();
  }, [loadNextQuestion]);

  const handleAnswer = useCallback(async (answer: string) => {
    if (feedback || !collocation) return;
    setSelectedAnswer(answer);

    try {
      const res = await submitCollocationAnswer({
        collocationIndex,
        answer,
      });

      setFeedback(res);

      setTimeout(() => {
        loadNextQuestion();
      }, AUTO_ADVANCE_DELAY);
    } catch {
      // ignore
    }
  }, [feedback, collocation, collocationIndex, loadNextQuestion]);

  if (!collocation) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--brand-9)] border-t-transparent" />
      </div>
    );
  }

  const showResult = feedback !== null;

  return (
    <div className="flex flex-1 flex-col">
      {/* Collocation type label */}
      <div className="mb-2 flex justify-center">
        <span className="text-xs text-[var(--gray-11)]">
          {TYPE_LABELS[collocation.type]}
        </span>
      </div>

      {/* Blank phrase */}
      <div className="mb-6 text-center text-2xl font-[Unbounded] font-bold leading-tight">
        <BlankSentence
          text={collocation.blank}
          filledValues={showResult ? [feedback.correctAnswer] : undefined}
          blankState={showResult ? (feedback.isCorrect ? 'correct' : 'wrong') : 'empty'}
        />
      </div>

      {/* Translation after answer */}
      {showResult && (
        <div className="mb-4 text-center text-sm text-[var(--gray-11)]">
          {feedback.translation}
        </div>
      )}

      {/* Options 2x2 */}
      <div className="grid grid-cols-2 gap-3">
        {collocation.options.map((option, idx) => {
          const isSelected = selectedAnswer === option;
          const isCorrectOption = option === feedback?.correctAnswer;
          const isWrongSelected = isSelected && !isCorrectOption;

          return (
            <Button
              key={`${collocationIndex}-${idx}`}
              variant={
                !showResult ? 'secondary' :
                isCorrectOption ? 'success' :
                isWrongSelected ? 'destructive' :
                'secondary'
              }
              disabled={showResult || false}
              onClick={() => handleAnswer(option)}
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
