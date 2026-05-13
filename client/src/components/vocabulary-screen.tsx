import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '@/stores/user-store';
import { useLearningStore } from '@/stores/learning-store';
import { useCollectionStore } from '@/stores/collection-store';
import { useTelegram } from '@/hooks/use-telegram';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { LearningHeader } from '@/components/game/learning-header';
import { CollectionsSheet } from '@/components/game/collections-sheet';
import { PassiveRecallCard } from '@/components/game/question-types/passive-recall-card';
import { PoolCard } from '@/components/game/question-types/pool-card';
import { FreeRecall } from '@/components/game/question-types/free-recall';
import { QuizContainer } from '@/components/game/quiz-container';
import { RewardFeedback } from '@/components/game/reward-feedback';
import { AnswerHistoryDrawer } from '@/components/answer-history-drawer';
import { BatchStartedScreen } from '@/components/game/batch-started-screen';
import { DailyLimitScreen } from '@/components/game/daily-limit-screen';
import type { RewardDisplay } from '@/types/game';
import type { ReviewGrade } from '@/types/api';

/**
 * /vocabulary/learn — главный экран обучения v2 (новая лестница).
 *
 *   Pool-card  → swipe Знаю/Изучаю/Отложить
 *   Passive    → «Не помню / 👁 / Помню» (компонент без изменений)
 *   Free-recall (L2 active) → ввод + auto-переход через 1.2с (legacy режим компонента)
 *   Free-recall (L3 review) → ввод + 4 grade-кнопки → submitGrade
 *   session_complete → soft-end экран
 */
export function VocabularyScreen() {
  const navigate = useNavigate();
  const { hapticImpact, hapticNotification } = useTelegram();
  const user = useUserStore((s) => s.user);
  const refreshProfile = useUserStore((s) => s.refreshProfile);

  const currentQuestion = useLearningStore((s) => s.currentQuestion);
  const currentTier = useLearningStore((s) => s.currentTier);
  const currentWordId = useLearningStore((s) => s.currentWordId);
  const feedback = useLearningStore((s) => s.feedback);
  const sessionComplete = useLearningStore((s) => s.sessionComplete);
  const isLoading = useLearningStore((s) => s.isLoading);
  const error = useLearningStore((s) => s.error);
  const collectionId = useLearningStore((s) => s.collectionId);
  const answerHistory = useLearningStore((s) => s.answerHistory);
  const clearHistory = useLearningStore((s) => s.clearHistory);
  const fetchNext = useLearningStore((s) => s.fetchNext);
  const submitAnswer = useLearningStore((s) => s.submitAnswer);
  const submitGrade = useLearningStore((s) => s.submitGrade);
  const poolSwipe = useLearningStore((s) => s.poolSwipe);
  const skip = useLearningStore((s) => s.skip);
  const setLastUserAnswer = useLearningStore((s) => s.setLastUserAnswer);
  const pendingBatchStarted = useLearningStore((s) => s.pendingBatchStarted);
  const pendingDailyLimitReached = useLearningStore((s) => s.pendingDailyLimitReached);
  const consumeBatchStarted = useLearningStore((s) => s.consumeBatchStarted);
  const consumeDailyLimitReached = useLearningStore((s) => s.consumeDailyLimitReached);
  const dailyPromotions = useLearningStore((s) => s.dailyPromotions);

  const library = useCollectionStore((s) => s.library);
  const isLoadingLibrary = useCollectionStore((s) => s.isLoadingLibrary);
  const fetchLibrary = useCollectionStore((s) => s.fetchLibrary);
  const setCollectionId = useLearningStore((s) => s.setCollectionId);
  // Маркер «library реально fetched хотя бы раз» — чтобы отличить
  // «ещё не загружали» от «загрузили, но пусто». Без этого race-condition:
  // первый fetchNext летел без collectionId до завершения fetchLibrary.
  const libraryFetchedRef = useRef(false);
  useEffect(() => {
    fetchLibrary().finally(() => { libraryFetchedRef.current = true; });
  }, [fetchLibrary]);

  // Авто-выбор активной коллекции если ещё не выбрана:
  // первая из библиотеки пользователя.
  // Зависим от library.length и library[0]?.id (не от library) — иначе
  // новые ссылки на тот же массив (Zustand-селектор) создают цикл.
  const firstCollectionId = library[0]?.id;
  useEffect(() => {
    if (collectionId === undefined && firstCollectionId !== undefined) {
      setCollectionId(firstCollectionId);
    }
  }, [collectionId, firstCollectionId, setCollectionId]);

  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [collectionsSheetOpen, setCollectionsSheetOpen] = useState(false);
  const [rewardDisplay, setRewardDisplay] = useState<RewardDisplay | null>(null);
  const rewardKeyRef = useRef(0);

  // Первая загрузка вопроса. Логика:
  //   - Если library ещё не загружена (isLoadingLibrary или libraryFetchedRef=false) — ждём.
  //   - Если library загружена и есть коллекции — ждём пока setCollectionId выставит первую.
  //   - Если library загружена и пуста — fetchNext без коллекции (session_complete).
  //   - Если collectionId выставлен — fetchNext с коллекцией.
  // Запрос НЕ повторяется если уже есть currentQuestion/sessionComplete/isLoading.
  // Жёсткая блокировка: после первого успешного fetchNext (или session_complete)
  // больше НЕ вызываем его автоматически до явного изменения collectionId
  // или пользовательского действия. Это убирает любые потенциальные циклы
  // из React Strict Mode, HMR re-mount, или изменения ссылок селекторов.
  const fetchedOnceRef = useRef(false);
  const libraryCount = library.length;
  useEffect(() => {
    if (fetchedOnceRef.current) return;
    if (currentQuestion || sessionComplete || isLoading) return;
    if (isLoadingLibrary || !libraryFetchedRef.current) return;
    if (libraryCount > 0 && collectionId === undefined) return; // ждём setCollectionId
    fetchedOnceRef.current = true;
    fetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId, libraryCount, isLoadingLibrary, currentQuestion, sessionComplete, isLoading]);

  // Сброс fetchedOnceRef при смене коллекции — позволяет автоматически
  // подгрузить новый вопрос для новой коллекции.
  useEffect(() => {
    fetchedOnceRef.current = false;
  }, [collectionId]);

  // Хаптик + refreshProfile при feedback
  useEffect(() => {
    if (feedback) {
      hapticNotification(feedback.isCorrect ? 'success' : 'error');
      if (feedback.xpEarned > 0) refreshProfile();
    }
  }, [feedback, hapticNotification, refreshProfile]);

  // Reward display (L1/L2 auto-flow)
  useEffect(() => {
    if (!feedback) return;
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
      doubleXp: false,
      key: rewardKeyRef.current,
    });
    const t = setTimeout(() => setRewardDisplay(null), 1900);
    return () => clearTimeout(t);
  }, [feedback]);

  const handlePassiveAnswer = useCallback((knew: boolean) => {
    hapticImpact('light');
    submitAnswer(knew);
  }, [hapticImpact, submitAnswer]);

  const handlePoolSwipe = useCallback((action: 'know' | 'learn' | 'snooze') => {
    hapticImpact('light');
    poolSwipe(action);
  }, [hapticImpact, poolSwipe]);

  // Free-recall: ответ. На L2 (active) — submitAnswer (auto-переход 1.2с).
  // На L3 (review) — НИЧЕГО не делаем здесь; компонент сам показывает результат,
  // далее юзер жмёт grade-кнопку → handleGrade.
  const handleFreeRecallAnswer = useCallback((meaningIdOrNull: number | null) => {
    if (currentTier === 'review') return; // L3 — через grade
    hapticImpact('light');
    const isCorrect = meaningIdOrNull !== null;
    submitAnswer(isCorrect);
  }, [currentTier, hapticImpact, submitAnswer]);

  const handleGrade = useCallback((grade: ReviewGrade, userAnswer: string) => {
    hapticImpact('light');
    submitGrade(grade, userAnswer);
  }, [hapticImpact, submitGrade]);

  const handleSkip = useCallback(() => {
    if (feedback || isLoading) return;
    hapticImpact('light');
    skip();
  }, [feedback, isLoading, hapticImpact, skip]);

  if (!user) return null;

  // ── Daily limit reached (топ приоритет) ─────────────────────────────────
  // Появляется когда дневной лимит изучения достигнут. Требует выбора:
  // «Размечать дальше» (продолжить обзор) или «На главную». Перекрывает
  // sessionComplete если оба активны.
  if (pendingDailyLimitReached && dailyPromotions) {
    return (
      <div className="flex h-full flex-col pt-4">
        <LearningHeader onHistoryClick={() => setHistoryDrawerOpen(true)} backTo="/" />
        <DailyLimitScreen
          count={dailyPromotions.count}
          onMarkMore={() => {
            // Сбрасываем флаг и session_complete, делаем fetchNext —
            // pickNext отдаст pool-card (обзор), т.к. daily=10 блокирует батч.
            consumeDailyLimitReached();
            useLearningStore.setState({ sessionComplete: null });
            fetchedOnceRef.current = false;
            fetchNext();
          }}
          onHome={() => {
            consumeDailyLimitReached();
            navigate('/');
          }}
        />
        <AnswerHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          history={answerHistory}
          onClear={clearHistory}
        />
      </div>
    );
  }

  // ── Batch started экран (между ответом и первым словом нового батча) ────
  // Автопереход через 2.5с или по тапу. Показывается ОДИН раз после старта
  // батча; затем consumeBatchStarted сбрасывает флаг.
  if (pendingBatchStarted) {
    return (
      <div className="flex h-full flex-col pt-4">
        <LearningHeader onHistoryClick={() => setHistoryDrawerOpen(true)} backTo="/" />
        <BatchStartedScreen
          size={pendingBatchStarted.size}
          onContinue={() => consumeBatchStarted()}
        />
        <AnswerHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          history={answerHistory}
          onClear={clearHistory}
        />
      </div>
    );
  }

  // ── session_complete экран ──────────────────────────────────────────────
  // Текст сообщения зависит от reason — иначе врёт «всё выучено» когда на самом
  // деле просто SRS-cooldown или коллекция кончилась.
  if (sessionComplete) {
    const { reason, counts, nextDueAt } = sessionComplete;
    const nextDue = nextDueAt ? new Date(nextDueAt) : null;
    const totalActive = counts.pool + counts.passive + counts.active + counts.review;

    let title = 'На сегодня всё';
    let body: string;
    if (reason === 'no_words') {
      title = 'Нет слов для изучения';
      body = 'Подпишитесь на коллекцию, чтобы начать.';
    } else if (reason === 'all_in_cooldown') {
      // Всё на review, ждёт SRS. nextDue должен быть.
      body = nextDue
        ? `Все слова из активной колоды на повторении. Возвращайтесь ${formatDate(nextDue)} — будут готовы новые карточки.`
        : 'Все слова на повторении. Возвращайтесь позже.';
    } else if (reason === 'collection_exhausted') {
      body = totalActive > 0
        ? `В этой коллекции пока нет новых слов для подачи. В работе: ${totalActive} ${pluralWords(totalActive)}, выучено: ${counts.mastered}.`
        : 'В этой коллекции закончились слова. Добавьте новую коллекцию.';
    } else {
      // all_recent — теоретически отрабатывает retry без exclude, но если дошло до UI:
      body = 'Слишком мало доступных слов. Попробуйте ещё раз.';
    }

    return (
      <div className="flex h-full flex-col pt-4">
        <LearningHeader onHistoryClick={() => setHistoryDrawerOpen(true)} backTo="/" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="text-lg font-semibold text-[var(--gray-12)]">{title}</div>
          <p className="text-sm text-[var(--gray-11)]">{body}</p>
          {/* Диагностический блок — счётчики тиров. Для пилота полезно видеть. */}
          {totalActive > 0 && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[var(--gray-10)]">
              {counts.pool > 0 && <><span>В пуле</span><span className="text-right">{counts.pool}</span></>}
              {counts.passive > 0 && <><span>Узнавание</span><span className="text-right">{counts.passive}</span></>}
              {counts.active > 0 && <><span>Активные</span><span className="text-right">{counts.active}</span></>}
              {counts.review > 0 && <><span>На повторении</span><span className="text-right">{counts.review}</span></>}
              {counts.mastered > 0 && <><span>Выучено</span><span className="text-right">{counts.mastered}</span></>}
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              variant="default"
              onClick={async () => {
                // Полный сброс всего состояния + fetchNext.
                useLearningStore.setState({
                  sessionComplete: null,
                  currentQuestion: null,
                  currentTier: null,
                  currentWordId: null,
                  feedback: null,
                  isLoading: false,
                  recentWordIds: [],
                });
                fetchedOnceRef.current = false;
                await fetchNext();
                console.log('[VocabularyScreen] after fetchNext:', {
                  currentQuestion: !!useLearningStore.getState().currentQuestion,
                  sessionComplete: !!useLearningStore.getState().sessionComplete,
                  tier: useLearningStore.getState().currentTier,
                });
              }}
            >
              Попробовать ещё
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')}>На главную</Button>
          </div>
        </div>
        <AnswerHistoryDrawer
          open={historyDrawerOpen}
          onOpenChange={setHistoryDrawerOpen}
          history={answerHistory}
          onClear={clearHistory}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden pb-4 pt-4">
      <LearningHeader onHistoryClick={() => setHistoryDrawerOpen(true)} backTo="/" />

      <div className="flex min-h-0 flex-1 flex-col">
        {/* Loading */}
        {!currentQuestion && !feedback && isLoading && (
          <div className="flex flex-1 flex-col items-center justify-center">
            <Skeleton className="h-10 w-40" />
            <div className="mt-10 grid w-full grid-cols-2 gap-3">
              <Skeleton className="h-14 rounded-lg" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          </div>
        )}

        {/* Error */}
        {!currentQuestion && !feedback && !isLoading && error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-center text-[var(--gray-11)]">{error}</p>
            <Button variant="secondary" onClick={() => fetchNext()}>Попробовать снова</Button>
          </div>
        )}

        {/* Empty (нет коллекции / нет данных) */}
        {!currentQuestion && !feedback && !isLoading && !error && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-center text-[var(--gray-11)]">Нет доступных слов. Добавьте коллекцию!</p>
            <Button variant="secondary" onClick={() => setCollectionsSheetOpen(true)}>Перейти к коллекциям</Button>
          </div>
        )}

        <CollectionsSheet open={collectionsSheetOpen} onOpenChange={setCollectionsSheetOpen} />

        {currentQuestion && currentWordId !== null && (
          <div className="flex min-h-0 flex-1 flex-col">
            <QuizContainer questionKey={`${currentWordId}-${currentTier ?? ''}`}>
              {currentQuestion.type === 'pool-card' ? (
                <PoolCard
                  question={currentQuestion}
                  disabled={isLoading || feedback !== null}
                  onSwipe={handlePoolSwipe}
                />
              ) : currentQuestion.type === 'passive-recall' ? (
                <PassiveRecallCard
                  question={currentQuestion}
                  disabled={isLoading}
                  onAnswer={handlePassiveAnswer}
                />
              ) : currentQuestion.type === 'free-recall' ? (
                <FreeRecall
                  questionKey={`${currentWordId}-${currentTier}`}
                  prompt={currentQuestion.prompt}
                  direction={currentQuestion.direction}
                  transcription={currentQuestion.transcription}
                  audioWord={currentQuestion.audioWord}
                  acceptableAnswers={currentQuestion.acceptableAnswers}
                  feedback={null}
                  disabled={isLoading}
                  meaningId={currentQuestion.meaningId}
                  onAnswer={handleFreeRecallAnswer}
                  onNext={fetchNext}
                  onTextSubmit={setLastUserAnswer}
                  onSkip={currentTier === 'review' ? undefined : handleSkip}
                  showSkip={currentTier !== 'review'}
                  meanings={currentQuestion.meanings}
                  forms={currentQuestion.forms}
                  gradeMode={currentTier === 'review'}
                  onGrade={currentTier === 'review' ? handleGrade : undefined}
                />
              ) : null}
            </QuizContainer>

            {rewardDisplay && (
              <div className="pointer-events-none absolute inset-x-0 bottom-20 flex justify-center">
                <RewardFeedback reward={rewardDisplay} />
              </div>
            )}
          </div>
        )}
      </div>

      <AnswerHistoryDrawer
        open={historyDrawerOpen}
        onOpenChange={setHistoryDrawerOpen}
        history={answerHistory}
        onClear={clearHistory}
      />
    </div>
  );
}

function pluralWords(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'слов';
  if (mod10 === 1) return 'слово';
  if (mod10 >= 2 && mod10 <= 4) return 'слова';
  return 'слов';
}

function formatDate(d: Date): string {
  // Грамматически согласовано с фразой «Возвращайтесь {…}».
  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / msPerDay);
  if (diffDays <= 0) {
    const hours = Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
    return `через ${hours} ч`;
  }
  if (diffDays === 1) return 'завтра';
  if (diffDays < 7) return `через ${diffDays} дн.`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}
