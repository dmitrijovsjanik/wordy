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
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [rewardDisplay, setRewardDisplay] = useState<{
    xp: number;
    xpMultiplier: number;
    lp: number;
    lpMultiplier: number;
    levelUp?: number;
    key: number;
  } | null>(null);
  const rewardKeyRef = useRef(0);
  const [streakBounceKey, setStreakBounceKey] = useState(0);
  const initialStreakRef = useRef(streak);
  const prevStreakRef = useRef(streak);
  // Храним ID первого вопроса, чтобы не анимировать его появление
  const firstMeaningIdRef = useRef<number | null>(null);

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

  // Хаптик при фидбеке
  useEffect(() => {
    if (feedback) {
      if (feedback.isCorrect) {
        hapticNotification('success');
      } else {
        hapticNotification('error');
      }
      // Обновляем профиль если XP изменился
      if (feedback.xpEarned > 0) {
        refreshProfile();
      }
    }
  }, [feedback, hapticNotification, refreshProfile]);

  // Streak bounce + flare trigger with gradual cooldown
  const [particleBurst, setParticleBurst] = useState(false);
  const [particleFading, setParticleFading] = useState(false);

  // Запоминаем ID первого вопроса при его появлении
  if (currentQuestion && firstMeaningIdRef.current === null) {
    firstMeaningIdRef.current = currentQuestion.meaningId;
  }

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

  // Reward display с автоочисткой после анимации
  useEffect(() => {
    if (!feedback || !feedback.isCorrect) return;

    rewardKeyRef.current += 1;

    // Используем модификаторы с сервера (в процентах: 100 = x1.0)
    // Конвертируем в дробный множитель для отображения
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

    // Очищаем после завершения анимации LP (1.8s — самая долгая)
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

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-4">
      {/* Player Status — level, XP, streak + league */}
      <PlayerStatusCard user={user} />

      {/* Duel card + ambient light spill */}
      <div className="relative mt-4">
        {/* Light spill under the card */}
        <div
          className="pointer-events-none absolute -bottom-3 left-[10%] right-[10%] h-8 rounded-[50%] opacity-50 blur-xl"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,100,20,0.6), rgba(255,60,0,0.3) 50%, transparent 80%)' }}
        />
      <button
        onClick={() => navigate('/duel/create')}
        className="duel-card relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-3 text-left text-white"
      >
        {/* SVG goo filter */}
        <svg className="absolute" width="0" height="0" aria-hidden="true">
          <defs>
            <filter id="duel-goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
              <feBlend in="SourceGraphic" in2="goo" />
            </filter>
          </defs>
        </svg>
        {/* Animated lava blobs */}
        <div className="pointer-events-none absolute inset-[-10px] overflow-hidden duel-lava-wrap">
          <div className="duel-lava-goo">
            <div className="duel-blob duel-blob--1" />
            <div className="duel-blob duel-blob--2" />
            <div className="duel-blob duel-blob--3" />
            <div className="duel-blob duel-blob--4" />
          </div>
        </div>
        {/* Pulsing glow border */}
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

        {!currentQuestion && !feedback && !isLoading && error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-center text-[var(--gray-11)]">{error}</p>
            <Button variant="secondary" onClick={() => fetchNext()}>
              Попробовать снова
            </Button>
          </div>
        )}

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

        {currentQuestion && (
          <>
            {/* Word */}
            <div className="relative flex flex-1 flex-col items-center justify-center">
              <div className="relative">
                {/* Streak bar — 16px gap above the word */}
                <AnimatePresence>
                  {streak >= 3 && (
                    <motion.div
                      key="streak"
                      className="absolute left-1/2"
                      style={{ bottom: 'calc(100% + 32px)' }}
                      initial={initialStreakRef.current >= 3 ? false : { opacity: 0, scaleX: 0, x: '-50%' }}
                      animate={{ opacity: 1, scaleX: 1, x: '-50%' }}
                      exit={{ opacity: 0, scale: 0.8, x: '-50%' }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    >
                      {/* Particles */}
                      <div className={cn(
                        'pointer-events-none absolute inset-x-0 -top-2 z-0 overflow-visible',
                        particleBurst && 'streak-particles-burst',
                        particleBurst && particleFading && 'streak-particles-fading',
                      )}>
                        <span className="streak-particle" style={{ left: '20%', animationDelay: '0s' }} />
                        <span className="streak-particle" style={{ left: '40%', animationDelay: '0.5s' }} />
                        <span className="streak-particle" style={{ left: '60%', animationDelay: '1.0s' }} />
                        <span className="streak-particle" style={{ left: '80%', animationDelay: '0.3s' }} />
                        <span className="streak-particle" style={{ left: '50%', animationDelay: '0.7s' }} />
                        <span className="streak-particle" style={{ left: '30%', animationDelay: '1.3s' }} />
                        <span className="streak-particle" style={{ left: '70%', animationDelay: '1.6s' }} />
                      </div>
                      {/* Glow layers — 3 overlapping with different periods for organic flicker */}
                      <div className="streak-glow" />
                      <motion.div
                        key={streakBounceKey}
                        className="relative z-10 flex h-8 items-center justify-center rounded-full border border-orange-500/20 bg-orange-950/80 px-3.5 shadow-[inset_0_0_10px_rgba(251,146,60,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]"
                        initial={false}
                        animate={streakBounceKey === 0 ? {} : {
                          scaleX: [1, 1.15, 0.95, 1],
                          scaleY: [1, 0.92, 1.04, 1],
                          filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1.15)', 'brightness(1)'],
                        }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                      >
                        <span className="whitespace-nowrap text-xs font-medium tracking-wide text-[var(--red-11)]">
                          {streak} подряд!
                        </span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestion.meaningId}
                    className="flex flex-col items-center"
                    // Не анимируем первый вопрос
                    initial={currentQuestion.meaningId === firstMeaningIdRef.current ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Оригинальная форма сверху мелко (shoes при word=shoe) */}
                    {currentQuestion.originalForm && (
                      <span className="mb-1 text-xs text-[var(--gray-10)]">
                        {currentQuestion.originalForm}
                      </span>
                    )}
                    <h2
                      className="max-w-full break-words px-4 text-center font-bold"
                      style={{
                        // Адаптивный размер: clamp(min, preferred, max)
                        // Для длинных слов уменьшаем preferred и max
                        fontSize: currentQuestion.word.length > 14
                          ? `clamp(1.25rem, 8vw, ${Math.max(1.5, 2.25 - (currentQuestion.word.length - 14) * 0.08)}rem)`
                          : currentQuestion.word.length > 10
                            ? `clamp(1.5rem, 9vw, ${2.25 - (currentQuestion.word.length - 10) * 0.05}rem)`
                            : 'clamp(1.75rem, 10vw, 2.25rem)',
                      }}
                    >
                      {currentQuestion.word}
                    </h2>
                    {currentQuestion.transcription && (
                      <span className="mt-1 text-sm text-[var(--gray-10)]">
                        [{currentQuestion.transcription}]
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Reward feedback — absolute so it doesn't shift the word */}
              {rewardDisplay && (
                <div key={rewardDisplay.key} className="absolute bottom-0 left-1/2 flex -translate-x-1/2 -translate-y-4 flex-col items-center gap-1">
                  {/* XP group — value + multiplier animate together */}
                  <div className="animate-reward-group flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-[var(--green-11)]">
                      +{rewardDisplay.xp} XP
                    </span>
                    {rewardDisplay.xpMultiplier > 1 && (
                      <span className="animate-multiplier-pop text-xs font-bold text-[var(--orange-10)]">
                        x{rewardDisplay.xpMultiplier.toFixed(1)}
                      </span>
                    )}
                  </div>

                  {/* LP group — value + multiplier, slower animation */}
                  {rewardDisplay.lp > 0 && (
                    <div className="animate-reward-group-slow flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--amber-11)]">
                        +{rewardDisplay.lp} LP
                      </span>
                      {rewardDisplay.lpMultiplier > 1 && (
                        <span className="animate-multiplier-pop-slow text-xs font-bold text-[var(--red-10)]">
                          x{rewardDisplay.lpMultiplier.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Level up notification */}
                  {rewardDisplay.levelUp && (
                    <span className="animate-reward-group text-sm font-bold text-[var(--accent-9)]">
                      Уровень {rewardDisplay.levelUp}!
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Options 2x2 */}
            <div className="grid w-full grid-cols-2 gap-3">
              {currentQuestion.options.map((option, idx) => {
                const isSelected = selectedOption === option;
                const showResult = feedback !== null;
                const isCorrectOption = option === feedback?.correctTranslation;
                const isWrongSelected = isSelected && !isCorrectOption;

                return (
                  <Button
                    key={`${currentQuestion.meaningId}-${idx}`}
                    variant={
                      !showResult ? 'secondary' :
                      isCorrectOption ? 'success' :
                      isWrongSelected ? 'destructive' :
                      'secondary'
                    }
                    disabled={showResult && !isSelected && !isCorrectOption}
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

            {/* Skip */}
            <Button
              variant="link"
              size="sm"
              disabled={feedback !== null || isLoading}
              onClick={handleSkip}
              className={cn(
                'mt-4',
                (feedback !== null || isLoading) && 'opacity-40',
              )}
            >
              Не знаю
            </Button>
          </>
        )}
      </div>

    </div>
  );
}
