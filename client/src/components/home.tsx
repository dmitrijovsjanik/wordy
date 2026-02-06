import { useEffect, useCallback, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useHomeStore } from '@/stores/home-store';
import { useLeagueStore } from '@/stores/league-store';
import { useTelegram } from '@/hooks/use-telegram';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';

// Новые модульные компоненты
import { WordDisplay } from '@/components/game/word-display';
import { MultipleChoice } from '@/components/game/question-types/multiple-choice';
import { Spelling } from '@/components/game/question-types/spelling';
import { RewardFeedback } from '@/components/game/reward-feedback';
import { StreakIndicator } from '@/components/game/streak-indicator';
import { QuizContainer } from '@/components/game/quiz-container';
import { StreakDaysIndicator } from '@/components/ui/streak-days-indicator';
import { StreakInfoSheet } from '@/components/ui/streak-info-sheet';
import { GemsIndicator } from '@/components/ui/gems-indicator';
import { Avatar } from '@/components/ui/avatar';
import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, Notification03Icon } from '@hugeicons/core-free-icons';
import { xpForLevel } from '@/lib/progression-config';
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

  const { progress, stats, season, isLoading: isLeagueLoading, fetchStatus } = useLeagueStore();
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    if (!season?.startedAt) return;
    const endDate = new Date(new Date(season.startedAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    const update = () => {
      const now = new Date();
      const diff = endDate.getTime() - now.getTime();
      if (diff <= 0) { setTimeLeft('0ч'); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      setTimeLeft(days > 0 ? `${days}д ${hours}ч` : `${hours}ч`);
    };
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [season?.startedAt]);

  // XP / Level progress
  const currentLevelXp = user ? xpForLevel(user.level) : 0;
  const nextLevelXp = user ? xpForLevel(user.level + 1) : 1;
  const xpProgress = user ? ((user.xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100 : 0;

  // Level ring params
  const lvlRingSize = 32;
  const lvlStroke = 2.5;
  const lvlRadius = (lvlRingSize - lvlStroke) / 2;
  const lvlCircumference = 2 * Math.PI * lvlRadius;
  const lvlDashoffset = lvlCircumference - (xpProgress / 100) * lvlCircumference;

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [rewardDisplay, setRewardDisplay] = useState<RewardDisplay | null>(null);
  const rewardKeyRef = useRef(0);
  const [streakBounceKey, setStreakBounceKey] = useState(0);
  const initialStreakRef = useRef(streak);
  const prevStreakRef = useRef(streak);
  const firstMeaningIdRef = useRef<number | null>(null);

  // Streak info sheet
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);

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
    if (!feedback) return;

    // При неправильном ответе — сразу скрываем награду
    if (!feedback.isCorrect) {
      setRewardDisplay(null);
      return;
    }

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

    // Определяем правильный ответ в зависимости от типа вопроса
    const correctAnswer = currentQuestion.type === 'spelling'
      ? currentQuestion.correctSpelling
      : currentQuestion.correctTranslation;

    const isCorrectGuess = option === correctAnswer;
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
    correctAnswer: currentQuestion?.type === 'spelling'
      ? (currentQuestion?.correctSpelling ?? feedback.correctTranslation)
      : feedback.correctTranslation,
  } : null;

  if (!user) return null;

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-4">
      {/* Row 1: Avatar + name | freeze + gems + notifications */}
      <div className="mb-2 flex items-center gap-3">
        <button onClick={() => navigate('/profile')} className="shrink-0">
          <Avatar src={user.avatarUrl} fallback={user.firstName} size={56} />
        </button>
        <StreakDaysIndicator count={user.streakDays} onClick={() => setStreakSheetOpen(true)} />
        <div className="flex-1" />
        <div className="flex items-center gap-3">
          <GemsIndicator gems={user.gems} freezes={user.streakFreezes} onClick={() => navigate('/shop')} />
          <button className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--gray-3)]">
            <HugeiconsIcon icon={Notification03Icon} size={24} className="text-[var(--gray-11)]" />
          </button>
        </div>
      </div>

      {/* Quiz Card */}
      <div className="mt-2 flex flex-1 flex-col">
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
          <div className="relative flex flex-1 flex-col">
            <QuizContainer questionKey={currentQuestion.meaningId}>
              <div className="flex flex-1 flex-col items-center justify-center">
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

              {/* Question type component */}
              {currentQuestion.type === 'spelling' ? (
                <Spelling
                  options={currentQuestion.options}
                  questionKey={currentQuestion.meaningId}
                  selectedAnswer={selectedOption}
                  feedback={answerFeedback}
                  disabled={isLoading}
                  onAnswer={handleAnswer}
                  onSkip={handleSkip}
                  showSkip
                />
              ) : (
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
              )}
            </QuizContainer>

            {/* Streak indicator — вне QuizContainer, над статус-баром */}
            <div className="pointer-events-none absolute inset-x-0 top-[5%] flex justify-center">
              <StreakIndicator
                streak={streak}
                bounceKey={streakBounceKey}
                particleBurst={particleBurst}
                particleFading={particleFading}
                skipInitialAnimation={initialStreakRef.current >= 3}
              />
            </div>

            {/* Status bar: league + level + streak — по центру */}
            <div className="absolute inset-x-0 top-[15%] flex justify-center">
              <div className="flex items-center gap-1.5">
                {!isLeagueLoading && progress ? (
                  <Link
                    to="/leaderboard"
                    className="flex h-8 items-center gap-1 rounded-full bg-[var(--gray-3)] pl-1 pr-2.5"
                  >
                    {(() => {
                      const Icon = LEAGUE_ICONS[progress.tier];
                      return <Icon size={24} className="shrink-0" />;
                    })()}
                    <span className="text-xs font-semibold">{stats?.leaguePoints ?? 0}</span>
                    <div className="h-3 w-px bg-[var(--gray-6)]" />
                    <div className="flex items-center gap-0.5 text-[10px] text-[var(--gray-11)]">
                      <HugeiconsIcon icon={Clock01Icon} size={10} />
                      <span>{timeLeft || '—'}</span>
                    </div>
                  </Link>
                ) : (
                  <Skeleton className="h-8 w-24 rounded-full" />
                )}

                {/* Level badge with progress ring */}
                <button className="relative flex items-center justify-center shrink-0" style={{ width: lvlRingSize, height: lvlRingSize }}>
                  <svg width={lvlRingSize} height={lvlRingSize} className="absolute inset-0 -rotate-90">
                    <circle
                      cx={lvlRingSize / 2} cy={lvlRingSize / 2} r={lvlRadius}
                      fill="var(--gray-3)" stroke="var(--gray-5)" strokeWidth={lvlStroke}
                    />
                    <circle
                      cx={lvlRingSize / 2} cy={lvlRingSize / 2} r={lvlRadius}
                      fill="none" stroke="var(--brand-9)" strokeWidth={lvlStroke}
                      strokeLinecap="round"
                      strokeDasharray={lvlCircumference}
                      strokeDashoffset={lvlDashoffset}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <span className="relative text-xs font-bold text-[var(--gray-12)]">{user.level}</span>
                </button>

              </div>
            </div>

            {/* Reward feedback — вне QuizContainer, между словом и кнопками */}
            {rewardDisplay && (
              <div className="pointer-events-none absolute inset-x-0 top-[50%] flex justify-center">
                <RewardFeedback reward={rewardDisplay} />
              </div>
            )}
          </div>
        )}
      </div>

      <StreakInfoSheet
        open={streakSheetOpen}
        onOpenChange={setStreakSheetOpen}
        streakDays={user.streakDays}
        createdAt={user.createdAt}
      />
    </div>
  );
}
