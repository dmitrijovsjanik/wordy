import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  VolumeHighIcon,
  LanguageCircleIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { useReadingStore } from '@/stores/reading-store';
import { useBackButton } from '@/hooks/use-back-button';
import { useSpeech } from '@/hooks/use-speech';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BackButton } from '@/components/ui/back-button';
import { cn } from '@/lib/utils';
import type { ReadingLevel } from '@/types/reading';

const LEVELS: { value: ReadingLevel; label: string; description: string }[] = [
  { value: 'A1', label: 'A1', description: 'Простые тексты' },
  { value: 'A2', label: 'A2', description: 'Базовые темы' },
  { value: 'B1', label: 'B1', description: 'Средняя сложность' },
];

function LevelBadge({ level }: { level: ReadingLevel }) {
  const variant = level === 'A1' ? 'success' : level === 'A2' ? 'primary' : 'default';
  return <Badge variant={variant}>{level}</Badge>;
}

function highlightTargetWords(text: string, targetWords: string[]): React.ReactNode[] {
  if (targetWords.length === 0) return [text];

  const escaped = targetWords.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="font-semibold text-[var(--brand-11)]">
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

// ─── Reading Phase ──────────────────────────────────────────────

function ReadingView() {
  const passage = useReadingStore((s) => s.passage);
  const showTranslation = useReadingStore((s) => s.showTranslation);
  const toggleTranslation = useReadingStore((s) => s.toggleTranslation);
  const goToQuestions = useReadingStore((s) => s.goToQuestions);
  const { speakLong, stop, isSpeaking, isLoading, error: ttsError } = useSpeech({ rate: 0.85 });

  if (!passage) return null;

  const highlighted = highlightTargetWords(passage.text, passage.targetWords);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col gap-4"
    >
      {/* Title + level */}
      <div className="flex items-center gap-2">
        <LevelBadge level={passage.level} />
        <h2 className="text-lg font-bold">{passage.title}</h2>
      </div>

      {/* Text */}
      <div className="rounded-2xl bg-[var(--gray-2)] px-4 py-4">
        <p className="text-base leading-relaxed text-[var(--gray-12)]">{highlighted}</p>
      </div>

      {/* Translation (toggle) */}
      <AnimatePresence>
        {showTranslation && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl bg-[var(--gray-3)] px-4 py-3"
          >
            <p className="text-sm leading-relaxed text-[var(--gray-11)]">{passage.textRu}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TTS error */}
      {ttsError && (
        <p className="text-xs text-[var(--red-10)]">{ttsError}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {isSpeaking ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={stop}
            className="gap-1.5"
          >
            Стоп
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => speakLong(passage.text)}
            disabled={isLoading}
            className={cn('gap-1.5', isLoading && 'animate-pulse')}
          >
            <HugeiconsIcon icon={VolumeHighIcon} size={16} strokeWidth={2} />
            {isLoading ? 'Загрузка...' : 'Озвучить'}
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={toggleTranslation}
          className="gap-1.5"
        >
          <HugeiconsIcon icon={LanguageCircleIcon} size={16} strokeWidth={2} />
          {showTranslation ? 'Скрыть перевод' : 'Перевод'}
        </Button>
      </div>

      {/* Go to questions */}
      <div className="mt-auto pb-4">
        <Button onClick={goToQuestions} className="w-full gap-2">
          К вопросам
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} />
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Question Phase ─────────────────────────────────────────────

function QuestionView() {
  const passage = useReadingStore((s) => s.passage);
  const currentQuestionIdx = useReadingStore((s) => s.currentQuestionIdx);
  const answers = useReadingStore((s) => s.answers);
  const feedbackVisible = useReadingStore((s) => s.feedbackVisible);
  const submitAnswer = useReadingStore((s) => s.submitAnswer);
  const nextQuestion = useReadingStore((s) => s.nextQuestion);

  if (!passage) return null;

  const question = passage.questions[currentQuestionIdx];
  if (!question) return null;

  const totalQuestions = passage.questions.length;
  const currentAnswer = answers.find((a) => a.questionIndex === currentQuestionIdx);
  const progressPercent = (currentQuestionIdx / totalQuestions) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-1 flex-col gap-5"
    >
      {/* Progress */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-[var(--gray-11)]">
          <span>
            {currentQuestionIdx + 1} / {totalQuestions}
          </span>
        </div>
        <Progress value={progressPercent} />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIdx}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex flex-1 flex-col gap-4"
        >
          <div>
            <p className="text-base font-semibold text-[var(--gray-12)]">{question.question}</p>
            <p className="mt-1 text-sm text-[var(--gray-11)]">{question.questionRu}</p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2">
            {question.options.map((option, idx) => {
              const isSelected = currentAnswer?.selectedIndex === idx;
              const isCorrect = currentAnswer?.correctIndex === idx;
              const showResult = feedbackVisible;

              let variant: 'secondary' | 'success' | 'destructive' = 'secondary';
              if (showResult && isCorrect) variant = 'success';
              else if (showResult && isSelected && !isCorrect) variant = 'destructive';

              return (
                <Button
                  key={idx}
                  variant={variant}
                  disabled={showResult}
                  onClick={() => void submitAnswer(idx)}
                  className={cn(
                    'h-auto min-h-[3rem] whitespace-normal px-4 py-3 text-left text-sm',
                    showResult && 'pointer-events-none',
                  )}
                >
                  {option}
                </Button>
              );
            })}
          </div>

          {/* Feedback + Next */}
          {feedbackVisible && currentAnswer && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-3"
            >
              <div
                className={cn(
                  'rounded-xl px-4 py-3 text-sm font-semibold',
                  currentAnswer.isCorrect
                    ? 'bg-[var(--green-3)] text-[var(--green-11)]'
                    : 'bg-[var(--red-3)] text-[var(--red-11)]',
                )}
              >
                {currentAnswer.isCorrect ? 'Правильно!' : 'Неправильно'}
              </div>
              <Button onClick={nextQuestion} className="w-full">
                {currentQuestionIdx + 1 >= totalQuestions ? 'Результат' : 'Следующий вопрос'}
              </Button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Finished Phase ─────────────────────────────────────────────

function FinishedView() {
  const passage = useReadingStore((s) => s.passage);
  const correctCount = useReadingStore((s) => s.correctCount);
  const fetchNext = useReadingStore((s) => s.fetchNext);

  if (!passage) return null;

  const total = passage.questions.length;
  const percentage = Math.round((correctCount / total) * 100);
  const label = percentage >= 80 ? 'Отлично!' : percentage >= 50 ? 'Хорошо!' : 'Попробуйте ещё!';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-1 flex-col items-center justify-center gap-6"
    >
      <div className="text-center">
        <div className="mb-2 text-2xl font-bold text-[var(--gray-12)]">{label}</div>
        <div className="text-4xl font-bold text-[var(--brand-9)]">
          {correctCount}/{total}
        </div>
        <div className="mt-1 text-sm text-[var(--gray-11)]">правильных ответов ({percentage}%)</div>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button onClick={() => void fetchNext()}>Следующий текст</Button>
      </div>
    </motion.div>
  );
}

// ─── Level Selector ─────────────────────────────────────────────

function LevelSelector() {
  const level = useReadingStore((s) => s.level);
  const setLevel = useReadingStore((s) => s.setLevel);
  const fetchNext = useReadingStore((s) => s.fetchNext);

  const handleSelect = useCallback(
    (selectedLevel: ReadingLevel) => {
      setLevel(selectedLevel);
    },
    [setLevel],
  );

  return (
    <div className="flex flex-1 flex-col gap-6 pt-4">
      <p className="text-center text-sm text-[var(--gray-11)]">Выберите уровень сложности</p>

      <div className="flex flex-col gap-2">
        {LEVELS.map((l) => (
          <button
            key={l.value}
            onClick={() => handleSelect(l.value)}
            className={cn(
              'flex w-full items-center gap-3 rounded-2xl bg-[var(--gray-2)] px-4 py-3 text-left transition-colors active:bg-[var(--gray-3)]',
              level === l.value && 'ring-2 ring-[var(--accent-9)]',
            )}
          >
            <LevelBadge level={l.value} />
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-semibold">{l.label}</span>
              <span className="text-xs text-[var(--gray-11)]">{l.description}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-auto pb-4">
        <Button onClick={() => void fetchNext()} disabled={!level} className="w-full">
          Начать читать
        </Button>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────

export function ReadingPage() {
  const navigate = useNavigate();
  const phase = useReadingStore((s) => s.phase);
  const passage = useReadingStore((s) => s.passage);
  const error = useReadingStore((s) => s.error);
  const fetchNext = useReadingStore((s) => s.fetchNext);
  const reset = useReadingStore((s) => s.reset);

  useBackButton(
    useCallback(() => {
      reset();
      navigate('/modes');
    }, [navigate, reset]),
  );

  return (
    <div className="flex h-full flex-col px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton
          onClick={() => {
            reset();
            navigate('/modes');
          }}
          variant="ghost"
        />
        <h1 className="text-xl font-bold">Чтение</h1>
      </div>

      {/* Content */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        {phase === 'select-level' ? (
          <LevelSelector />
        ) : error && !passage ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <p className="text-center text-sm text-[var(--red-11)]">{error}</p>
            <Button variant="secondary" onClick={() => void fetchNext()}>
              Попробовать снова
            </Button>
          </div>
        ) : phase === 'loading' ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sm text-[var(--gray-11)]">Загрузка...</span>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {phase === 'reading' && <ReadingView key="reading" />}
            {phase === 'question' && <QuestionView key="question" />}
            {phase === 'finished' && <FinishedView key="finished" />}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
