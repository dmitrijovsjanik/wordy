import { useState, useCallback, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { BookOpen02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getNextTenseExercise, submitTenseAnswer } from '@/lib/api';
import { splitAnswer } from '@/components/game/blank-sentence';
import { TENSE_REFERENCE_DATA, type FormulaPartRole } from './tense-reference-data';
import type { TenseExercise, TenseAnswerResponse } from '@/types/grammar';

// ─── Color styles matching the reference ──────────────────────────────────────

const FORMULA_STYLES: Record<FormulaPartRole, string> = {
  subject: 'rounded px-1 py-0.5 font-semibold bg-[var(--blue-3)] text-[var(--blue-11)]',
  auxiliary: 'rounded px-1 py-0.5 font-semibold bg-[var(--violet-3)] text-[var(--violet-11)]',
  'main-verb': 'rounded px-1 py-0.5 font-semibold bg-[var(--green-3)] text-[var(--green-11)]',
  ending: 'rounded px-1 py-0.5 font-semibold bg-[var(--amber-3)] text-[var(--amber-11)]',
  connector: 'text-[var(--gray-9)]',
  punctuation: 'text-[var(--gray-9)]',
  plain: '',
};

const TENSE_LABELS: Record<string, string> = {
  present_simple: 'Present Simple',
  present_continuous: 'Present Continuous',
  present_perfect: 'Present Perfect',
  present_perfect_continuous: 'Present Perfect Continuous',
  past_simple: 'Past Simple',
  past_continuous: 'Past Continuous',
  past_perfect: 'Past Perfect',
  past_perfect_continuous: 'Past Perfect Continuous',
  future_simple: 'Future Simple',
  future_going_to: 'Future Simple',
  future_continuous: 'Future Continuous',
  future_perfect: 'Future Perfect',
};

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Начинающий',
  2: 'Средний',
  3: 'Продвинутый',
};

type TenseQuizProps = {
  difficulty?: 1 | 2 | 3;
  onSwitchView?: () => void;
};

type QuizState = 'loading' | 'question' | 'feedback' | 'error';

export function TenseQuiz({ difficulty, onSwitchView }: TenseQuizProps) {
  const [state, setState] = useState<QuizState>('loading');
  const [exercise, setExercise] = useState<TenseExercise | null>(null);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<TenseAnswerResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadNextQuestion = useCallback(async () => {
    setState('loading');
    setSelectedAnswer(null);
    setFeedback(null);

    try {
      const response = await getNextTenseExercise(difficulty);
      setExercise(response.exercise);
      setExerciseIndex(response.exerciseIndex);
      setState('question');
    } catch {
      setErrorMessage('Не удалось загрузить вопрос. Попробуйте ещё раз.');
      setState('error');
    }
  }, [difficulty]);

  const handleAnswer = useCallback(async (answer: string) => {
    if (state !== 'question') return;

    setSelectedAnswer(answer);

    try {
      const result = await submitTenseAnswer({ exerciseIndex, answer });
      setFeedback(result);
      setState('feedback');
    } catch {
      setErrorMessage('Не удалось проверить ответ. Попробуйте ещё раз.');
      setState('error');
    }
  }, [state, exerciseIndex]);

  // Initial load
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      loadNextQuestion();
    }
  }, [loadNextQuestion]);

  if (state === 'loading') {
    return <QuizSkeleton />;
  }

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 px-4 py-8">
        <p className="text-center text-sm text-[var(--gray-11)]">{errorMessage}</p>
        <Button onClick={loadNextQuestion}>Попробовать ещё раз</Button>
      </div>
    );
  }

  if (!exercise) return null;

  return (
    <div className="flex min-h-full flex-col px-4 pb-6">
      {/* Top bar: difficulty + reference */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary">
          {DIFFICULTY_LABELS[exercise.difficulty] ?? `Уровень ${exercise.difficulty}`}
        </Badge>
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

      {/* Sentence — vertically centered like main quiz */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <SentenceDisplay
          sentence={exercise.sentence}
          subject={exercise.subject}
          correctAnswer={state === 'feedback' ? feedback?.correctAnswer : undefined}
        />
        <p className="mt-2 text-center text-sm text-[var(--gray-10)]">
          {exercise.sentenceRu}
        </p>
      </div>

      {/* Bottom: options + feedback */}
      <div className="flex flex-col gap-4">
        {/* Options grid 2x2 */}
        <div className="grid w-full grid-cols-2 gap-3">
          {exercise.options.map((option, idx) => {
            const isSelected = selectedAnswer === option;
            const isCorrectOption = feedback ? option === feedback.correctAnswer : false;
            const isWrongSelected = isSelected && feedback && !feedback.isCorrect;
            const showResult = state === 'feedback';

            return (
              <Button
                key={`${exerciseIndex}-${idx}`}
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
                )}
              >
                {showResult ? option : <ColorizedOption text={option} />}
              </Button>
            );
          })}
        </div>

        {/* Feedback section */}
        {state === 'feedback' && feedback && (
          <div className="flex flex-col gap-3">
            {/* Explanation */}
            <div className={cn(
              'rounded-2xl p-4',
              feedback.isCorrect
                ? 'bg-[var(--green-2)]'
                : 'bg-[var(--red-2)]',
            )}>
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-sm font-medium',
                  feedback.isCorrect
                    ? 'text-[var(--green-11)]'
                    : 'text-[var(--red-11)]',
                )}>
                  {feedback.isCorrect ? 'Правильно!' : 'Неправильно'}
                </p>
                <Badge variant="primary">
                  {TENSE_LABELS[feedback.tense] ?? feedback.tense}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--gray-12)]">
                {feedback.explanation}
              </p>

              <TenseFormula tenseId={feedback.tense} sentence={exercise.sentence} correctAnswer={feedback.correctAnswer} />

              {/* Signal words */}
              {feedback.signalWords.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs text-[var(--gray-11)]">
                    Сигнальные слова:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {feedback.signalWords.map((word) => (
                      <Badge key={word} variant="success">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Next button */}
            <Button onClick={loadNextQuestion} className="w-full">
              Далее
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────

function highlightSubject(text: string, subject: string): ReactNode[] {
  // Find the LAST word-boundary match of subject in text (closest to the blank)
  const lowerText = text.toLowerCase();
  const lowerSubject = subject.toLowerCase();

  let bestIdx = -1;
  let searchFrom = 0;
  while (searchFrom <= lowerText.length - lowerSubject.length) {
    const idx = lowerText.indexOf(lowerSubject, searchFrom);
    if (idx === -1) break;
    const charBefore = idx > 0 ? lowerText[idx - 1] : ' ';
    const charAfter = idx + lowerSubject.length < lowerText.length ? lowerText[idx + lowerSubject.length] : ' ';
    if (!/[a-z]/.test(charBefore) && !/[a-z]/.test(charAfter)) {
      bestIdx = idx; // keep searching for a later match
    }
    searchFrom = idx + 1;
  }

  if (bestIdx === -1) return [text];

  const before = text.slice(0, bestIdx);
  const matched = text.slice(bestIdx, bestIdx + subject.length);
  const after = text.slice(bestIdx + subject.length);
  const parts: ReactNode[] = [];
  if (before) parts.push(before);
  parts.push(
    <span key="subj" className="font-semibold text-[var(--blue-11)]">
      {matched}
    </span>,
  );
  if (after) parts.push(after);
  return parts;
}

const AUXILIARIES = new Set([
  'do', 'does', 'did',
  'am', 'is', 'are', 'was', 'were',
  'have', 'has', 'had',
  'will',
  "don't", "doesn't", "didn't",
  "isn't", "aren't", "wasn't", "weren't",
  "haven't", "hasn't", "hadn't",
  "won't",
]);

function ColorizedOption({ text }: { text: string }) {
  // Split on " ... " (ellipsis separator) first
  const ellipsisParts = text.split(' ... ');

  if (ellipsisParts.length >= 2) {
    // "Do ... speak", "have ... been waiting", "Will ... be using"
    return (
      <>
        {ellipsisParts.map((part, i) => (
          <span key={i}>
            {i > 0 && <span className="text-[var(--gray-9)]"> ... </span>}
            <ColorizedPhrase phrase={part} />
          </span>
        ))}
      </>
    );
  }

  return <ColorizedPhrase phrase={text} />;
}

/** Split a verb word into stem (green) + ending (amber): playing → play + ing */
function VerbWithEnding({ word }: { word: string }) {
  const lower = word.toLowerCase();

  // -ing: "playing" → "play" + "ing", "running" → "runn" + "ing"
  if (lower.endsWith('ing') && lower.length > 3) {
    const stem = word.slice(0, -3);
    return (
      <>
        <span className="text-[var(--green-11)]">{stem}</span>
        <span className="text-[var(--amber-11)]">ing</span>
      </>
    );
  }

  // -ed: "played" → "play" + "ed", "visited" → "visit" + "ed"
  if (lower.endsWith('ed') && lower.length > 3) {
    const stem = word.slice(0, -2);
    return (
      <>
        <span className="text-[var(--green-11)]">{stem}</span>
        <span className="text-[var(--amber-11)]">ed</span>
      </>
    );
  }

  // -es: "goes" → "go" + "es", "watches" → "watch" + "es", "does" → "do" + "es"
  if (lower.endsWith('es') && lower.length > 3 &&
    (lower.endsWith('oes') || lower.endsWith('shes') || lower.endsWith('ches') ||
     lower.endsWith('sses') || lower.endsWith('xes') || lower.endsWith('zes'))) {
    const stem = word.slice(0, -2);
    return (
      <>
        <span className="text-[var(--green-11)]">{stem}</span>
        <span className="text-[var(--amber-11)]">es</span>
      </>
    );
  }

  // -s: "plays" → "play" + "s", "likes" → "like" + "s"
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3 &&
    !AUXILIARIES.has(lower)) {
    const stem = word.slice(0, -1);
    return (
      <>
        <span className="text-[var(--green-11)]">{stem}</span>
        <span className="text-[var(--amber-11)]">s</span>
      </>
    );
  }

  // No ending detected — plain green verb
  return <span className="text-[var(--green-11)]">{word}</span>;
}

function ColorizedPhrase({ phrase }: { phrase: string }) {
  const words = phrase.split(/\s+/);
  let auxEnd = 0;
  for (let i = 0; i < words.length; i++) {
    const lower = words[i].toLowerCase();
    if (AUXILIARIES.has(lower) || lower === 'been' || lower === 'going' || lower === 'to'
      || lower === 'always' || lower === 'already' || lower === 'just' || lower === 'never'
      || lower === 'not') {
      auxEnd = i + 1;
    } else {
      break;
    }
  }

  const renderVerb = (verbWords: string) => {
    const vWords = verbWords.split(/\s+/);
    return (
      <>
        {vWords.map((w, i) => (
          <span key={i}>
            {i > 0 && ' '}
            <VerbWithEnding word={w} />
          </span>
        ))}
      </>
    );
  };

  if (auxEnd >= words.length) {
    if (words.length === 1) {
      const isAux = AUXILIARIES.has(words[0].toLowerCase());
      return isAux
        ? <span className="text-[var(--violet-11)]">{phrase}</span>
        : renderVerb(phrase);
    }
    const auxPart = words.slice(0, -1).join(' ');
    const verbWord = words[words.length - 1];
    return (
      <>
        <span className="text-[var(--violet-11)]">{auxPart}</span>
        {' '}
        <VerbWithEnding word={verbWord} />
      </>
    );
  }

  if (auxEnd === 0) {
    return renderVerb(phrase);
  }

  const auxPart = words.slice(0, auxEnd).join(' ');
  const verbPart = words.slice(auxEnd).join(' ');
  return (
    <>
      <span className="text-[var(--violet-11)]">{auxPart}</span>
      {' '}
      {renderVerb(verbPart)}
    </>
  );
}

function SentenceDisplay({ sentence, subject, correctAnswer }: { sentence: string; subject?: string; correctAnswer?: string }) {
  const parts = sentence.split(/(___)/g);
  let subjectHighlighted = false;

  // Split correctAnswer by " ... " for multi-blank sentences
  const answerParts = correctAnswer ? splitAnswer(correctAnswer) : [];
  let blankIdx = 0;

  return (
    <h5 className="max-w-full break-words px-4 text-center text-2xl font-[Unbounded] font-bold leading-tight text-[var(--gray-12)]">
      {parts.map((part, idx) => {
        if (part === '___') {
          if (correctAnswer) {
            const answerText = answerParts[blankIdx] ?? correctAnswer;
            blankIdx++;
            return (
              <span
                key={idx}
                className="mx-0.5 inline-block border-b-2 px-1 text-center font-bold border-[var(--green-9)] text-[var(--green-11)]"
              >
                {answerText}
              </span>
            );
          }
          return (
            <span
              key={idx}
              className="mx-0.5 inline-block min-w-[3rem] border-b-2 px-1 text-center border-[var(--brand-9)] text-[var(--brand-9)]"
            >
              {'\u00A0'}
            </span>
          );
        }
        if (subject && !subjectHighlighted && part.trim().length > 0) {
          const highlighted = highlightSubject(part, subject);
          if (highlighted.length > 1) {
            subjectHighlighted = true;
            return <span key={idx}>{highlighted}</span>;
          }
        }
        return <span key={idx}>{part}</span>;
      })}
    </h5>
  );
}

function getSentenceFormLabel(sentence: string, correctAnswer: string): string {
  if (sentence.includes('?')) return 'Вопрос';
  if (/n't\b/.test(correctAnswer) || /\bnot\b/.test(correctAnswer)) return 'Отрицание';
  return 'Утверждение';
}

function TenseFormula({ tenseId, sentence, correctAnswer }: { tenseId: string; sentence: string; correctAnswer: string }) {
  const tense = useMemo(
    () => TENSE_REFERENCE_DATA.find((t) => t.id === tenseId),
    [tenseId],
  );
  if (!tense) return null;

  const formLabel = getSentenceFormLabel(sentence, correctAnswer);
  const form = tense.forms.find((f) => f.label === formLabel);
  if (!form) return null;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1">
        <span className="mr-1 text-[11px] font-medium text-[var(--gray-10)]">
          {formLabel === 'Утверждение' ? '+' : formLabel === 'Отрицание' ? '−' : '?'}
        </span>
        {form.formula.map((part, i) => (
          <span key={i} className={cn('text-xs', FORMULA_STYLES[part.role])}>
            {part.text}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuizSkeleton() {
  return (
    <div className="flex flex-col gap-5 px-4 pb-6">
      <div className="h-6 w-20 animate-pulse rounded-full bg-[var(--gray-3)]" />
      <div className="h-28 animate-pulse rounded-2xl bg-[var(--gray-3)]" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-full bg-[var(--gray-3)]" />
        ))}
      </div>
    </div>
  );
}
