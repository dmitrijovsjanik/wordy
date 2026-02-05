import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useHomeStore } from '@/stores/home-store';
import { useTelegram } from '@/hooks/use-telegram';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerStatusCard } from '@/components/ui/player-status-card';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sword01Icon } from '@hugeicons/core-free-icons';

// Новые модульные компоненты
import { WordDisplay } from '@/components/game/word-display';
import { MultipleChoice } from '@/components/game/question-types/multiple-choice';
import { RewardFeedback } from '@/components/game/reward-feedback';
import { StreakIndicator } from '@/components/game/streak-indicator';
import type { RewardDisplay, AnswerFeedback } from '@/types/game';

export function Home() {
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();
  const user = useUserStore((s) => s.user);
  const refreshProfile = useUserStore((s) => s.refreshProfile);

  const {
    currentQuestion,
    feedback,
    isLoading,
    error,
    streak,
    fetchNext,
    submitAnswer,
    skip,
  } = useHomeStore();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [rewardDisplay, setRewardDisplay] = useState<RewardDisplay | null>(null);
  const rewardKeyRef = useRef(0);
  const [streakBounceKey, setStreakBounceKey] = useState(0);
  const initialStreakRef = useRef(streak);
  const prevStreakRef = useRef(streak);
  const firstMeaningIdRef = useRef<number | null>(null);

  // Streak particles state
  const [particleBurst, setParticleBurst] = useState(false);
  const [particleFading, setParticleFading] = useState(false);

  useEffect(() => {
    if (!currentQuestion && !feedback && !isLoading) {
      fetchNext();
    }
  }, []);

  // Сброс выбора при новом вопросе
  useEffect(() => {
    if (currentQuestion) {
      setSelectedOption(null);
    }
  }, [currentQuestion]);

  // Запоминаем ID первого вопроса
  if (currentQuestion && firstMeaningIdRef.current === null) {
    firstMeaningIdRef.current = currentQuestion.meaningId;
  }

  // Хаптик при фидбеке
  useEffect(() => {
    if (feedback) {
      hapticNotification(feedback.isCorrect ? 'success' : 'error');
      if (feedback.xpEarned > 0) {
        refreshProfile();
      }
    }
  }, [feedback, hapticNotification, refreshProfile]);

  // Streak bounce + particles
  useEffect(() => {
    if (streak === prevStreakRef.current) return;
    prevStreakRef.current = streak;
    if (streak >= 3) {
      setStreakBounceKey((k) => k + 1);
      setParticleBurst(true);
      setParticleFading(false);

      const t1 = setTimeout(() => setParticleFading(true), 400);
      const t2 = setTimeout(() => { setParticleBurst(false); setParticleFading(false); }, 1200);

      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [streak]);

  // Reward display
  useEffect(() => {
    if (!feedback || !feedback.isCorrect) return;

    rewardKeyRef.current += 1;
    const xpMultiplier = (feedback.xpModifier ?? 100) / 100;
    const lpMultiplier = (feedback.lpModifier ?? 100) / 100;

    setRewardDisplay({
      xp: feedback.xpEarned,
      xpMultiplier,
      lp: feedback.lpEarned,
      lpMultiplier,
      levelUp: feedback.levelUp,
      key: rewardKeyRef.current,
    });

    const clearTimer = setTimeout(() => setRewardDisplay(null), 1900);
    return () => clearTimeout(clearTimer);
  }, [feedback]);

  const handleAnswer = useCallback((option: string) => {
    if (feedback || isLoading || !currentQuestion) return;
    hapticImpact('light');
    setSelectedOption(option);

    const isCorrectGuess = option === currentQuestion.correctTranslation;
    submitAnswer(isCorrectGuess ? currentQuestion.meaningId : null);
  }, [feedback, isLoading, currentQuestion, hapticImpact, submitAnswer]);

  const handleSkip = useCallback(() => {
    if (feedback || isLoading || !currentQuestion) return;
    hapticImpact('light');
    setSelectedOption(null);
    skip();
  }, [feedback, isLoading, currentQuestion, hapticImpact, skip]);

  // Преобразуем feedback в AnswerFeedback для компонента
  const answerFeedback: AnswerFeedback | null = feedback ? {
    isCorrect: feedback.isCorrect,
    correctAnswer: feedback.correctTranslation,
  } : null;

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-4">
      {/* Player Status */}
      <PlayerStatusCard user={user} />

      {/* Duel card */}
      <div className="relative mt-4">
        <div
          className="pointer-events-none absolute -bottom-3 left-[10%] right-[10%] h-8 rounded-[50%] opacity-50 blur-xl"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,100,20,0.6), rgba(255,60,0,0.3) 50%, transparent 80%)' }}
        />
        <button
          onClick={() => navigate('/duel/create')}
          className="duel-card relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left text-white"
        >
          <svg className="absolute" width="0" height="0" aria-hidden="true">
            <defs>
              <filter id="duel-goo">
                <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                <feBlend in="SourceGraphic" in2="goo" />
              </filter>
            </defs>
          </svg>
          <div className="pointer-events-none absolute inset-[-10px] overflow-hidden duel-lava-wrap">
            <div className="duel-lava-goo">
              <div className="duel-blob duel-blob--1" />
              <div className="duel-blob duel-blob--2" />
              <div className="duel-blob duel-blob--3" />
              <div className="duel-blob duel-blob--4" />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-2xl duel-glow-border" />
          <HugeiconsIcon strokeWidth={2} icon={Sword01Icon} size={20} className="relative z-10" />
          <div className="relative z-10 flex flex-1 flex-col">
            <h3 className="text-sm font-semibold">Дуэль</h3>
            <span className="text-xs opacity-80">Сразись с другом</span>
          </div>
          <span className="relative z-10 inline-flex shrink-0 items-center justify-center rounded-xl bg-white/20 px-3 py-1.5 text-xs font-medium text-white">
            Бросить вызов
          </span>
        </button>
      </div>

      {/* Quiz Card */}
      <div className="mt-4 flex flex-1 flex-col">
        {/* Loading state */}
        {!currentQuestion && !feedback && isLoading && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <Skeleton className="h-10 w-40" />
            <div className="mt-10 grid w-full grid-cols-2 gap-3">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          </div>
        )}

        {/* Error state */}
        {!currentQuestion && !feedback && !isLoading && error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-center text-[var(--gray-11)]">{error}</p>
            <Button variant="secondary" onClick={() => fetchNext()}>
              Попробовать снова
            </Button>
          </div>
        )}

        {/* Empty state */}
        {!currentQuestion && !feedback && !isLoading && !error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-center text-[var(--gray-11)]">
              Нет доступных слов. Добавьте коллекцию!
            </p>
            <Button variant="secondary" onClick={() => navigate('/collections')}>
              Перейти к коллекциям
            </Button>
          </div>
        )}

        {/* Question */}
        {currentQuestion && (
          <>
            <div className="relative flex flex-1 flex-col items-center justify-center">
              <div className="relative">
                {/* Streak indicator */}
                <StreakIndicator
                  streak={streak}
                  bounceKey={streakBounceKey}
                  particleBurst={particleBurst}
                  particleFading={particleFading}
                  skipInitialAnimation={initialStreakRef.current >= 3}
                />

                {/* Word display */}
                <WordDisplay
                  word={currentQuestion.word}
                  originalForm={currentQuestion.originalForm}
                  transcription={currentQuestion.transcription}
                  meaningId={currentQuestion.meaningId}
                  skipInitialAnimation={currentQuestion.meaningId === firstMeaningIdRef.current}
                  showSpeaker={currentQuestion.direction === 'en-ru'}
                />
              </div>

              {/* Reward feedback */}
              {rewardDisplay && <RewardFeedback reward={rewardDisplay} />}
            </div>

            {/* Multiple choice options */}
            <MultipleChoice
              options={currentQuestion.options}
              questionKey={currentQuestion.meaningId}
              selectedAnswer={selectedOption}
              feedback={answerFeedback}
              disabled={isLoading}
              onAnswer={handleAnswer}
              onSkip={handleSkip}
              showSkip
            />
          </>
        )}
      </div>
    </div>
  );
}
