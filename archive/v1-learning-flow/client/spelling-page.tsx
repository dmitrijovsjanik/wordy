import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBackButton } from '@/hooks/use-back-button';
import { useTelegram } from '@/hooks/use-telegram';
import { BackButton } from '@/components/ui/back-button';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spelling } from '@/components/game/question-types/spelling';
import { WordDisplay } from '@/components/game/word-display';
import { quizNext, quizAnswerInfinite } from '@/lib/api';
import { useUserStore } from '@/stores/user-store';
import type { QuizQuestionBase } from '@/types/api';
import type { AnswerFeedback } from '@/types/game';

// QuizQuestionBase используется и для multiple-choice, и для spelling.
// Сужаем по type='spelling'.
type SpellingQ = QuizQuestionBase & { type: 'spelling'; correctSpelling: string };

/**
 * Страница режима «Спеллинг».
 *
 * Доступ только через /modes — на главной spelling больше не появляется.
 * Локальное состояние (без unified-game-store), серверный путь —
 * /api/quiz/next?type=spelling и /api/quiz/answer-infinite.
 */
export function SpellingPage() {
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();
  const refreshProfile = useUserStore((s) => s.refreshProfile);

  const [question, setQuestion] = useState<SpellingQ | null>(null);
  const [feedback, setFeedback] = useState<AnswerFeedback | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recentMeaningIds = useRef<number[]>([]);

  useBackButton(useCallback(() => navigate('/'), [navigate]));

  const fetchNext = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setFeedback(null);
    setSelected(null);
    try {
      const res = await quizNext(recentMeaningIds.current, undefined, 'spelling', [], 0, 0, 0);
      if (res.question?.type === 'spelling') {
        const q = res.question as SpellingQ;
        setQuestion(q);
        recentMeaningIds.current = [...recentMeaningIds.current, q.meaningId].slice(-20);
      } else {
        setQuestion(null);
        setError('Нет доступных слов для спеллинга');
      }
    } catch {
      setError('Не удалось загрузить');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNext();
  }, [fetchNext]);

  const handleAnswer = useCallback(async (option: string) => {
    if (!question || feedback) return;
    hapticImpact('light');
    setSelected(option);
    const isCorrectGuess = option === question.correctSpelling;
    try {
      const res = await quizAnswerInfinite(
        question.meaningId,
        isCorrectGuess ? question.meaningId : null,
        0,
        false,
        false,
      );
      hapticNotification(res.isCorrect ? 'success' : 'error');
      setFeedback({
        isCorrect: res.isCorrect,
        correctAnswer: question.correctSpelling ?? res.correctTranslation,
        examples: res.examples,
        mnemonic: res.mnemonic,
      });
      if (res.xpEarned > 0) refreshProfile();
      setTimeout(() => fetchNext(), 1500);
    } catch {
      setError('Ошибка отправки');
    }
  }, [question, feedback, hapticImpact, hapticNotification, refreshProfile, fetchNext]);

  const handleSkip = useCallback(async () => {
    if (!question || feedback) return;
    hapticImpact('light');
    try {
      await quizAnswerInfinite(question.meaningId, null, 0, false, true);
      fetchNext();
    } catch {
      setError('Ошибка отправки');
    }
  }, [question, feedback, hapticImpact, fetchNext]);

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-8">
      <BackButton onClick={() => navigate('/')} />

      <div className="mt-4 flex flex-col">
        <h1 className="text-xl font-bold">Спеллинг</h1>
        <p className="text-sm text-[var(--gray-11)]">Выберите правильное написание</p>
      </div>

      {error && (
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="text-center text-[var(--gray-11)]">{error}</p>
          <Button variant="secondary" onClick={fetchNext}>Попробовать снова</Button>
        </div>
      )}

      {!error && isLoading && !question && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <Skeleton className="h-10 w-40" />
          <div className="grid w-full grid-cols-2 gap-3">
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        </div>
      )}

      {!error && question && (
        <div className="mt-8 flex flex-1 flex-col gap-8">
          <WordDisplay
            word={question.word}
            originalForm={question.originalForm}
            transcription={question.transcription}
            meaningId={question.meaningId}
            skipInitialAnimation={false}
            showSpeaker={question.direction === 'en-ru'}
          />
          <Spelling
            options={question.options}
            questionKey={question.meaningId}
            selectedAnswer={selected}
            feedback={feedback}
            disabled={isLoading}
            onAnswer={handleAnswer}
            onSkip={handleSkip}
            showSkip
          />
        </div>
      )}
    </div>
  );
}
