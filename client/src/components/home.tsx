import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useHomeStore } from '@/stores/home-store';
import { useTelegram } from '@/hooks/use-telegram';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sword01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Lottie from 'lottie-react';
import fireStreakData from '@/assets/fire-streak.json';

function xpForLevel(level: number) {
  return (level - 1) * (level - 1) * 100;
}

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
  const [xpDisplay, setXpDisplay] = useState<{ xp: number; levelUp?: number; key: number } | null>(null);
  const xpKeyRef = useRef(0);
  const [streakBounceKey, setStreakBounceKey] = useState(0);
  const initialStreakRef = useRef(streak);
  const prevStreakRef = useRef(streak);
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!currentQuestion && !feedback) {
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

  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

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

  // XP display с автоочисткой после анимации
  useEffect(() => {
    if (!feedback || feedback.xpEarned <= 0) return;

    xpKeyRef.current += 1;
    setXpDisplay({ xp: feedback.xpEarned, levelUp: feedback.levelUp, key: xpKeyRef.current });

    // Очищаем после завершения анимации (1.4s)
    const clearTimer = setTimeout(() => setXpDisplay(null), 1400);

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

  const currentLevelXp = xpForLevel(user.level);
  const nextLevelXp = xpForLevel(user.level + 1);
  const progressPercent = ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-4">
      {/* Header — level & XP */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-0.5">
            <span className="text-2xl font-bold leading-none text-[var(--accent-11)]">{user.level}</span>
            <span className="text-sm text-[var(--gray-11)]">ур.</span>
          </div>
          <div className="flex items-center gap-3 text-[14px] text-[var(--gray-11)]">
            <span>
              {user.xp - currentLevelXp} / {nextLevelXp - currentLevelXp} XP
            </span>
            {user.streakDays > 0 && (
              <div className="flex items-center gap-1">
                <Lottie animationData={fireStreakData} loop autoplay className="relative -top-[3px] -mr-1 h-5 w-5 shrink-0" />
                {user.streakDays} дн.
              </div>
            )}
          </div>
        </div>
        <Progress value={progressPercent} />
      </div>

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
        <Button variant="secondary" size="compact" className="relative z-10 shrink-0 bg-white/20 text-white hover:bg-white/30" tabIndex={-1}>
          Бросить вызов
        </Button>
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
                        className="relative z-10 flex h-8 items-center justify-center gap-0.5 rounded-full border border-orange-500/20 bg-orange-950/80 pl-2.5 pr-3.5 shadow-[inset_0_0_10px_rgba(251,146,60,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]"
                        initial={false}
                        animate={streakBounceKey === 0 ? {} : {
                          scaleX: [1, 1.15, 0.95, 1],
                          scaleY: [1, 0.92, 1.04, 1],
                          filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1.15)', 'brightness(1)'],
                        }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                      >
                        <Lottie animationData={fireStreakData} loop autoplay className="relative -top-0.5 h-5 w-5 shrink-0" />
                        <span className="whitespace-nowrap text-xs font-medium tracking-wide text-[var(--red-11)]">
                          {streak} подряд!
                        </span>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <AnimatePresence mode="wait">
                  <motion.h2
                    key={currentQuestion.meaningId}
                    className="text-4xl font-bold"
                    initial={!hasMountedRef.current ? false : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {currentQuestion.word}
                  </motion.h2>
                </AnimatePresence>
              </div>

              {/* XP feedback — absolute so it doesn't shift the word */}
              {xpDisplay && (
                <div key={xpDisplay.key} className="absolute bottom-0 left-1/2 flex -translate-x-1/2 -translate-y-4 flex-col items-center">
                  <span className="animate-xp-float text-sm font-semibold text-[var(--green-11)]">
                    +{xpDisplay.xp} XP
                  </span>
                  {xpDisplay.levelUp && (
                    <span className="animate-xp-float text-sm font-bold text-[var(--accent-9)]">
                      Уровень {xpDisplay.levelUp}!
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Options 2x2 */}
            <div className="grid w-full grid-cols-2 gap-3">
              {currentQuestion.options.map((option) => {
                const isSelected = selectedOption === option;
                const showResult = feedback !== null;
                const isCorrectOption = option === feedback?.correctTranslation;
                const isWrongSelected = isSelected && !isCorrectOption;

                return (
                  <Button
                    key={`${currentQuestion.meaningId}-${option}`}
                    variant={
                      !showResult ? 'secondary' :
                      isCorrectOption ? 'success' :
                      isWrongSelected ? 'destructive' :
                      'secondary'
                    }
                    disabled={showResult && !isSelected && !isCorrectOption}
                    onClick={() => handleAnswer(option)}
                    className={cn(
                      'h-14 px-4 text-center text-sm',
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
