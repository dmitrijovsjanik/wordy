import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useUnifiedGameStore } from '@/stores/unified-game-store';
import { useLeagueStore } from '@/stores/league-store';
import { useCollectionStore } from '@/stores/collection-store';
import { useTelegram } from '@/hooks/use-telegram';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { LEAGUE_ICONS } from '@/components/ui/league-icons';

// Новые модульные компоненты
import { WordDisplay } from '@/components/game/word-display';
import { MultipleChoice } from '@/components/game/question-types/multiple-choice';
import { EncounterCard } from '@/components/game/question-types/encounter-card';
import { PassiveRecallCard } from '@/components/game/question-types/passive-recall-card';
import { EmbeddedReview } from '@/components/game/embedded-review';
import { RewardFeedback } from '@/components/game/reward-feedback';
import { motion, AnimatePresence } from 'framer-motion';
import { QuizContainer } from '@/components/game/quiz-container';
import { LearningHeader } from '@/components/game/learning-header';
import { MatchPairs } from '@/components/game/question-types/match-pairs';
import { Listening } from '@/components/game/question-types/listening';
import { Dictation } from '@/components/game/question-types/dictation';
import { FreeRecall } from '@/components/game/question-types/free-recall';
import { ClozeInput } from '@/components/game/question-types/cloze-input';
import { BlankSentence } from '@/components/game/blank-sentence';
import { WordFormsList } from '@/components/game/word-forms-display';
import { cn } from '@/lib/utils';
import { ExampleSentences } from '@/components/game/example-sentences';
import { MnemonicCard } from '@/components/game/mnemonic-card';
import { MilestoneModal } from '@/components/milestone-modal';
import { DoubleXpBackground } from '@/components/game/double-xp-background';
import { StreakDaysIndicator } from '@/components/ui/streak-days-indicator';
import { StreakInfoSheet } from '@/components/ui/streak-info-sheet';
import { GemsIndicator } from '@/components/ui/gems-indicator';
import { Avatar } from '@/components/ui/avatar';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Clock01Icon, CheckListIcon, AlertCircleIcon } from '@hugeicons/core-free-icons';
import { LIVES_ENABLED } from '@/lib/feature-flags';
import { PILOT_FEATURES } from '@/lib/pilot-config';
import { xpForLevel } from '@/lib/progression-config';
import { AnswerHistoryDrawer } from '@/components/answer-history-drawer';
import { LivesExhaustedDrawer } from '@/components/game/lives-exhausted-drawer';
import { FavouriteIcon } from '@hugeicons/core-free-icons';
import type { RewardDisplay, AnswerFeedback } from '@/types/game';

function getQuizContainerKey(
  q: import('@/types/api').QuizQuestion,
  questionIndex: number,
): string {
  // Включаем questionIndex чтобы тот же meaningId, показанный дважды
  // подряд (демо-режим, маленькое окно anti-repeat), приводил к
  // размонтированию компонента вопроса. Иначе локальный state (например,
  // localFeedback в FreeRecall) переносится на следующий вопрос и
  // блокирует ввод.
  const meaningId = q.type === 'match-pairs' ? q.pairs[0]?.meaningId ?? 0 : (q as { meaningId: number }).meaningId;
  return `${meaningId}-${questionIndex}`;
}

export function VocabularyScreen() {
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
    collectionId,
    doubleXpTimeLimitMs,
    doubleXpExpired,
    answerHistory,
    lives,
    livesRestoredAt,
    livesExhausted,
    fetchNext,
    submitAnswer,
    submitMatchPairsResults,
    submitEncounter,
    submitPassiveRecall,
    skip,
    currentTier,
    problemsMode,
    setProblemsMode,
    questionIndex,
    expireDoubleXp,
    setLastUserAnswer,
    clearHistory,
    restoreLives,
    onLivesTimerExpired,
    mode,
  } = useUnifiedGameStore();

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

  // Premium check (for infinite lives)
  const isPremium = user?.premiumUntil ? new Date(user.premiumUntil) > new Date() : false;

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
  const [listeningRevealed, setListeningRevealed] = useState(false);
  const rewardKeyRef = useRef(0);
  const prevStreakRef = useRef(streak);
  const firstMeaningIdRef = useRef<number | null>(null);

  // Milestone modal queue
  const [milestoneQueue, setMilestoneQueue] = useState<Array<{ id: string; type: string; threshold: number; title: string; description: string; gemsReward: number; icon: string }>>([]);
  const currentMilestone = milestoneQueue[0] ?? null;

  const handleMilestoneClose = useCallback(() => {
    setMilestoneQueue(prev => prev.slice(1));
    refreshProfile();
  }, [refreshProfile]);

  // Streak info sheet
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);

  // Answer history drawer
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

  const handleExitProblemsMode = useCallback(() => {
    setProblemsMode(false);
    fetchNext();
  }, [setProblemsMode, fetchNext]);

  const library = useCollectionStore((s) => s.library);
  const fetchLibrary = useCollectionStore((s) => s.fetchLibrary);

  useEffect(() => { fetchLibrary(); }, [fetchLibrary]);

  // Название коллекции для бейджа фокусировки.
  const focusCollectionName = collectionId
    ? library.find((c) => c.id === collectionId)?.title ?? null
    : null;

  const handleExitFocus = useCallback(() => {
    // Сбрасываем collectionId без очистки currentQuestion, чтобы QuizContainer
    // анимировал переход плавно (fade out → fade in) вместо мигания скелетона.
    useUnifiedGameStore.setState({ collectionId: undefined, recentMeaningIds: [], recentGenerators: [] });
    fetchNext();
  }, [fetchNext]);

  const handleDoubleXpExpired = useCallback(() => {
    expireDoubleXp();
    hapticNotification('warning');
  }, [expireDoubleXp, hapticNotification]);

  const showDoubleXpTimer = PILOT_FEATURES.xpBoost && !!doubleXpTimeLimitMs && !doubleXpExpired && !feedback;


  // Sync lives from user profile
  useEffect(() => {
    if (user) {
      useUnifiedGameStore.getState().updateLives(user.lives, user.livesRestoredAt);
    }
  }, [user?.lives, user?.livesRestoredAt]);

  useEffect(() => {
    if (!currentQuestion && !feedback && !isLoading) {
      fetchNext();
    }
  }, []);

  // Сброс выбора и награды при новом вопросе
  useEffect(() => {
    if (currentQuestion) {
      setSelectedOption(null);
      setRewardDisplay(null);
      setListeningRevealed(false);
    }
  }, [currentQuestion]);

  // Запоминаем ID первого вопроса
  if (currentQuestion && firstMeaningIdRef.current === null) {
    if (currentQuestion.type === 'match-pairs') {
      firstMeaningIdRef.current = currentQuestion.pairs[0]?.meaningId ?? null;
    } else if (typeof currentQuestion.type === 'string' && currentQuestion.type.startsWith('grammar-')) {
      // grammar-вопросы не имеют meaningId
      firstMeaningIdRef.current = null;
    } else {
      firstMeaningIdRef.current = (currentQuestion as { meaningId: number }).meaningId;
    }
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

  // Queue milestones from feedback
  useEffect(() => {
    if (feedback?.milestones && feedback.milestones.length > 0) {
      setMilestoneQueue(prev => [...prev, ...feedback.milestones!]);
    }
  }, [feedback]);

  // Track streak changes
  useEffect(() => {
    prevStreakRef.current = streak;
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
      doubleXp: feedback.doubleXpApplied,
      key: rewardKeyRef.current,
    });

    const clearTimer = setTimeout(() => setRewardDisplay(null), 1900);
    return () => clearTimeout(clearTimer);
  }, [feedback]);

  const handleAnswer = useCallback((option: string) => {
    if (feedback || isLoading || !currentQuestion || currentQuestion.type === 'match-pairs') return;
    // Encounter обрабатывается собственным хендлером.
    if (currentQuestion.type === 'encounter') return;
    hapticImpact('light');
    setSelectedOption(option);

    // Определяем правильный ответ в зависимости от типа вопроса.
    // dictation и free-recall используют текстовый ввод, не попадают сюда.
    let correctAnswer: string | undefined;
    switch (currentQuestion.type) {
      case 'listening':
        correctAnswer = currentQuestion.correctAnswer;
        break;
      case 'dictation':
      case 'free-recall':
      case 'cloze-input':
        return;
      default: {
        // QuizQuestionBase (multiple-choice). После guard'ов выше тип сужен,
        // но TS не выводит это полностью — используем явный cast.
        const q = currentQuestion as { correctTranslation?: string; meaningId: number };
        correctAnswer = q.correctTranslation;
      }
    }

    const meaningId = (currentQuestion as { meaningId: number }).meaningId;
    const isCorrectGuess = option === correctAnswer;
    submitAnswer(isCorrectGuess ? meaningId : null, option);
  }, [feedback, isLoading, currentQuestion, hapticImpact, submitAnswer]);

  const handleSkip = useCallback(() => {
    if (feedback || isLoading || !currentQuestion) return;
    hapticImpact('light');
    setSelectedOption(null);
    skip();
  }, [feedback, isLoading, currentQuestion, hapticImpact, skip]);

  const handleMatchPairsComplete = useCallback((results: Array<{ meaningId: number; isCorrect: boolean }>) => {
    submitMatchPairsResults(results);
  }, [submitMatchPairsResults]);

  const handleMatchPairsSkip = useCallback(() => {
    if (isLoading || !currentQuestion || currentQuestion.type !== 'match-pairs') return;
    hapticImpact('light');
    // Все пары считаются неправильными
    const results = currentQuestion.pairs.map((p) => ({ meaningId: p.meaningId, isCorrect: false }));
    submitMatchPairsResults(results);
  }, [isLoading, currentQuestion, hapticImpact, submitMatchPairsResults]);

  // Преобразуем feedback в AnswerFeedback для компонента.
  // ВАЖНО: для correctAnswer берём значение из вопроса (не из сервера),
  // чтобы оно совпадало с текстом опций (сервер может вернуть другое из-за TRANSLATION_DISPLAY).
  const answerFeedback: AnswerFeedback | null = feedback ? {
    isCorrect: feedback.isCorrect,
    correctAnswer: currentQuestion?.type === 'listening'
      ? (currentQuestion?.correctAnswer ?? feedback.correctTranslation)
      : currentQuestion?.type === 'dictation'
        ? (currentQuestion?.correctAnswer ?? feedback.correctTranslation)
        : currentQuestion?.type === 'free-recall'
          ? (currentQuestion?.acceptableAnswers?.[0] ?? feedback.correctTranslation)
          : (currentQuestion && 'correctTranslation' in currentQuestion && currentQuestion.correctTranslation)
            ? currentQuestion.correctTranslation
            : feedback.correctTranslation,
    examples: feedback.examples,
    mnemonic: feedback.mnemonic,
  } : null;

  if (!user) return null;

  // Встроенный обзор — заменяет учебный UI целиком, со своим header'ом.
  // Условие после всех hooks выше, чтобы не нарушать правила React.
  if (mode === 'embedded_review' || mode === 'embedded_review_empty') {
    return <EmbeddedReview />;
  }

  return (
    <>
      {/* Full-screen double XP background — outside main container for correct z-stacking */}
      <AnimatePresence>
        {showDoubleXpTimer && doubleXpTimeLimitMs && (
          <DoubleXpBackground timeLimitMs={doubleXpTimeLimitMs} onExpired={handleDoubleXpExpired} />
        )}
      </AnimatePresence>

    <div className="relative z-[2] flex h-full flex-col overflow-hidden pb-4 pt-4">
      <LearningHeader onHistoryClick={() => setHistoryDrawerOpen(true)} backTo="/" />

      {/* Lives indicator — скрыт когда система жизней отключена. */}
      {LIVES_ENABLED && (
        <div className="mb-2 flex items-center justify-center gap-1">
          {isPremium ? (
            <div className="flex items-center gap-1 rounded-full bg-[var(--red-3)] px-2.5 py-1">
              <HugeiconsIcon icon={FavouriteIcon} size={14} className="text-[var(--red-9)] [&_path]:fill-current" strokeWidth={2} />
              <span className="text-xs font-semibold text-[var(--red-11)]">&infin;</span>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <HugeiconsIcon
                  key={i}
                  icon={FavouriteIcon}
                  size={16}
                  className={i < lives ? 'text-[var(--red-9)] [&_path]:fill-current' : 'text-[var(--gray-6)]'}
                  strokeWidth={2}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quiz Card */}
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
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

        {currentQuestion && (
          <div className="flex min-h-0 flex-1 flex-col">
            <QuizContainer questionKey={getQuizContainerKey(currentQuestion!, questionIndex)}>
              {currentQuestion && currentQuestion.type === 'encounter' ? (
                /* L1 encounter — флешкарта в той же стилистике что L2
                   passive-recall (max-w-sm × h-[60vh], флип по тапу).
                   Без бейджа «Новое слово» — для визуальной консистентности
                   с L2/L3/L4, где tier-меток тоже нет. */
                <EncounterCard
                  question={currentQuestion}
                  disabled={isLoading || feedback !== null}
                  onAnswer={() => submitEncounter()}
                />
              ) : currentQuestion && currentQuestion.type === 'passive-recall' ? (
                /* L2 passive recall — карточка во всю высоту с кнопками
                   «Не помню / переворот / Помню» в футере (Figma 5123:7411). */
                <PassiveRecallCard
                  question={currentQuestion}
                  disabled={isLoading}
                  onAnswer={(knew) => submitPassiveRecall(knew)}
                />
              ) : currentQuestion && currentQuestion.type === 'free-recall' ? (
                /* L3 free-recall — карточка во всю высоту с инпутом в футере
                   (Figma 5221:7688). Слово сверху с magic-blur'ом до ответа.
                   Поток: submit → видно результат → клик стрелка → onAnswer + fetchNext. */
                <FreeRecall
                  questionKey={currentQuestion.meaningId}
                  prompt={currentQuestion.prompt}
                  direction={currentQuestion.direction}
                  transcription={currentQuestion.transcription}
                  audioWord={currentQuestion.audioWord}
                  acceptableAnswers={currentQuestion.acceptableAnswers}
                  feedback={null}
                  disabled={isLoading}
                  meaningId={currentQuestion.meaningId}
                  onAnswer={submitAnswer}
                  onNext={fetchNext}
                  onTextSubmit={setLastUserAnswer}
                  onSkip={handleSkip}
                  showSkip
                  hideResultPanel
                  meanings={currentQuestion.meanings}
                />
              ) : currentQuestion && (
                <>
                  {/* 3-сигнальный прогресс: passive/active = «В процессе», review = «Знакомое» */}
                  {currentTier && currentTier !== 'encounter' && (
                    <div className="mb-2 flex justify-center">
                      <Badge variant="secondary">
                        {currentTier === 'review' || currentTier === 'production' ? 'Знакомое' : 'В процессе'}
                      </Badge>
                    </div>
                  )}
                  {/* Word / Title area */}
                  {currentQuestion.type === 'match-pairs' ? (
                    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                      <div className="relative">
                        <AnimatePresence>
                          {showDoubleXpTimer && (
                            <motion.span
                              key="double-xp-label-mp"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="absolute -top-8 left-1/2 -translate-x-1/2 select-none font-[Unbounded] text-2xl font-black text-[var(--green-9)]"
                            >
                              x2
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <h2 className="mb-1 text-2xl font-[Unbounded] font-bold text-[var(--gray-12)]">Соедините пары</h2>
                      </div>
                      <p className="text-sm text-[var(--gray-11)]">Нажмите на слово, затем на его перевод</p>
                    </div>
                  ) : currentQuestion.type === 'listening' ? (
                    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                      <div className="relative flex flex-col items-center">
                        <AnimatePresence>
                          {showDoubleXpTimer && (
                            <motion.span
                              key="double-xp-label-listen"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="absolute -top-8 left-1/2 -translate-x-1/2 select-none font-[Unbounded] text-2xl font-black text-[var(--green-9)]"
                            >
                              x2
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <WordDisplay
                          word={currentQuestion.audioWord}
                          originalForm={null}
                          transcription={null}
                          meaningId={currentQuestion.meaningId}
                          skipInitialAnimation
                          showSpeaker={false}
                          blurred={!listeningRevealed && !answerFeedback}
                          onRevealClick={() => setListeningRevealed(true)}
                        />
                        <AnimatePresence mode="wait">
                          {!listeningRevealed && !answerFeedback ? (
                            <motion.span
                              key="listening-label"
                              initial={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="mt-1 text-sm text-[var(--gray-11)]"
                            >
                              Что вы слышите?
                            </motion.span>
                          ) : (listeningRevealed || answerFeedback) && currentQuestion.transcription ? (
                            <motion.span
                              key="listening-transcription"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.25, delay: 0.1 }}
                              className="mt-1 text-sm text-[var(--gray-10)]"
                            >
                              [{currentQuestion.transcription}]
                            </motion.span>
                          ) : null}
                        </AnimatePresence>
                      </div>
                      {rewardDisplay && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
                          <RewardFeedback reward={rewardDisplay} />
                        </div>
                      )}
                    </div>
                  ) : currentQuestion.type === 'dictation' ? (
                    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                      <div className="relative">
                        <AnimatePresence>
                          {showDoubleXpTimer && (
                            <motion.span
                              key="double-xp-label-dictation"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="absolute -top-8 left-1/2 -translate-x-1/2 select-none font-[Unbounded] text-2xl font-black text-[var(--green-9)]"
                            >
                              x2
                            </motion.span>
                          )}
                        </AnimatePresence>
                        <WordDisplay
                          word={currentQuestion.hint}
                          originalForm={null}
                          transcription={null}
                          meaningId={currentQuestion.meaningId}
                          skipInitialAnimation={currentQuestion.meaningId === firstMeaningIdRef.current}
                          showSpeaker={false}
                        />
                      </div>
                      <p className="mt-2 text-sm text-[var(--gray-11)]">Напишите слово на английском</p>
                      {rewardDisplay && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
                          <RewardFeedback reward={rewardDisplay} />
                        </div>
                      )}
                    </div>
                  ) : currentQuestion.type === 'cloze-input' ? (
                    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                      {/* Cloze-input: предложение с пропуском — стимул на всю
                          высоту stimulus-блока (как WordDisplay у L3). После
                          валидации пропуск окрашивается + появляется перевод. */}
                      <div className="relative w-full">
                        <div className="text-center text-2xl font-[Unbounded] font-bold leading-tight">
                          {/* filledValues всегда передаём, чтобы пропуск
                              резервировал ширину настоящего слова. До ответа
                              текст невидим (blankState=empty → text-transparent
                              в BlankSentence). */}
                          <BlankSentence
                            text={currentQuestion.sentence}
                            filledValues={[currentQuestion.correctAnswer]}
                            blankState={
                              !answerFeedback
                                ? 'empty'
                                : answerFeedback.isCorrect
                                  ? 'correct'
                                  : 'wrong'
                            }
                          />
                        </div>
                        <AnimatePresence>
                          {answerFeedback && (
                            <motion.div
                              key="cloze-translation"
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 text-center text-sm text-[var(--gray-11)]"
                            >
                              {currentQuestion.sentenceRu}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      {rewardDisplay && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
                          <RewardFeedback reward={rewardDisplay} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center pb-8">
                      {/* Word display (multiple-choice / spelling) */}
                      <div className="relative">
                        <AnimatePresence>
                          {showDoubleXpTimer && (
                            <motion.span
                              key="double-xp-label"
                              initial={{ opacity: 0, scale: 0.5 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.5 }}
                              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                              className="absolute -top-8 left-1/2 -translate-x-1/2 select-none font-[Unbounded] text-2xl font-black text-[var(--green-9)]"
                            >
                              x2
                            </motion.span>
                          )}
                        </AnimatePresence>
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
                      {rewardDisplay && (
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
                          <RewardFeedback reward={rewardDisplay} />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Answer buttons */}
                  <div className="shrink-0">
                    {currentQuestion.type === 'match-pairs' ? (
                      <MatchPairs
                        pairs={currentQuestion.pairs}
                        questionKey={currentQuestion.pairs.map((p) => p.meaningId).join('-')}
                        disabled={isLoading}
                        onComplete={handleMatchPairsComplete}
                        onSkip={handleMatchPairsSkip}
                        showSkip
                      />
                    ) : currentQuestion.type === 'listening' ? (
                      <Listening
                        options={currentQuestion.options}
                        questionKey={currentQuestion.meaningId}
                        selectedAnswer={selectedOption}
                        feedback={answerFeedback}
                        disabled={isLoading}
                        onAnswer={handleAnswer}
                        onSkip={handleSkip}
                        showSkip
                        audioWord={currentQuestion.audioWord}
                        transcription={currentQuestion.transcription}
                      />
                    ) : currentQuestion.type === 'dictation' ? (
                      <Dictation
                        questionKey={currentQuestion.meaningId}
                        audioWord={currentQuestion.audioWord}
                        hint={currentQuestion.hint}
                        correctAnswer={currentQuestion.correctAnswer}
                        acceptableAnswers={currentQuestion.acceptableAnswers}
                        feedback={answerFeedback}
                        disabled={isLoading}
                        onAnswer={submitAnswer}
                        onTextSubmit={setLastUserAnswer}
                        onSkip={handleSkip}
                        showSkip
                        meaningId={currentQuestion.meaningId}
                      />
                    ) : currentQuestion.type === 'cloze-input' ? (
                      <ClozeInput
                        questionKey={`${currentQuestion.meaningId}-${questionIndex}`}
                        acceptableAnswers={currentQuestion.acceptableAnswers}
                        feedback={null}
                        disabled={isLoading}
                        meaningId={currentQuestion.meaningId}
                        onAnswer={submitAnswer}
                        onTextSubmit={setLastUserAnswer}
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
                  </div>


                  {/* Example sentences after answer */}
                  {answerFeedback && answerFeedback.examples && answerFeedback.examples.length > 0 && (
                    <div className="mt-3 shrink-0">
                      <ExampleSentences examples={answerFeedback.examples} />
                    </div>
                  )}

                  {/* Mnemonic after answer */}
                  {answerFeedback && answerFeedback.mnemonic && (
                    <div className="mt-2 shrink-0">
                      <MnemonicCard text={answerFeedback.mnemonic} />
                    </div>
                  )}

                </>
              )}
            </QuizContainer>
          </div>
        )}
      </div>

      {/* Lives exhausted drawer — отключён вместе с системой жизней. */}
      {LIVES_ENABLED && (
        <LivesExhaustedDrawer
          open={livesExhausted}
          onOpenChange={(open) => { if (!open) onLivesTimerExpired(); }}
          livesRestoredAt={livesRestoredAt}
          gems={user.gems}
          refillCost={250}
          onRefill={restoreLives}
          onTimerExpired={onLivesTimerExpired}
        />
      )}

      <StreakInfoSheet
        open={streakSheetOpen}
        onOpenChange={setStreakSheetOpen}
        streakDays={user.streakDays}
        createdAt={user.createdAt}
      />

    </div>

    {/* Milestone modal */}
    <MilestoneModal milestone={currentMilestone} onClose={handleMilestoneClose} />

    {/* Answer history drawer */}
    <AnswerHistoryDrawer
      open={historyDrawerOpen}
      onOpenChange={setHistoryDrawerOpen}
      history={answerHistory}
      onClear={clearHistory}
    />
    </>
  );
}
