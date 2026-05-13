import { useState, useRef, useEffect } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick01Icon, ArrowRight01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { checkAnswer, type AnswerResult } from '@/lib/answer-check';
import { cn } from '@/lib/utils';
import { LearningCard, type LearningCardMeaning } from '@/components/game/learning-card';
import type { WordMeaningInfo, ReviewGrade, WordFormsInfo } from '@/types/api';

type FreeRecallFeedback = {
  result: AnswerResult;
  correctAnswer: string;
};

type FreeRecallProps = {
  questionKey: string | number;
  prompt: string;
  direction: 'en-ru' | 'ru-en';
  transcription: string | null;
  audioWord?: string;
  acceptableAnswers: string[];
  feedback: FreeRecallFeedback | null;
  disabled?: boolean;
  meaningId: number;
  onAnswer: (meaningId: number | null) => void;
  onTextSubmit?: (text: string) => void;
  onSkip?: () => void;
  showSkip?: boolean;
  hideResultPanel?: boolean;
  /** Все значения слова (топ-3 по popularity_rank). Заполнено на L3 word-level. */
  meanings?: WordMeaningInfo[];
  /** Грамматические формы слова. Рендерятся inline после транскрипции +
   *  в отдельном дровере с расшифровкой. */
  forms?: WordFormsInfo | null;
  /** Опциональный явный «следующий вопрос» — вызывается после клика на стрелку.
   *  Если задан, после onAnswer сразу подгружаем следующий вопрос; иначе полагаемся
   *  на серверный таймер store (если он включён для этого типа). */
  onNext?: () => void;
  /** L3-режим: после результата вместо «→» показываются 4 кнопки grade.
   *  Клик любой кнопки вызывает onGrade(grade, userAnswer). */
  gradeMode?: boolean;
  onGrade?: (grade: ReviewGrade, userAnswer: string) => void;
};

/**
 * Free Recall — L3-карточка (tier=active). Дизайн Wordy 2.2 (Figma 5221:7688).
 *
 * Карточка:
 *   - заголовок «Введите слово на английском»
 *   - слово + транскрипция СВЕРХУ С ЭФФЕКТОМ БЛЮРА (контуры видно, прочесть нельзя)
 *   - список значений (русский перевод + часть речи) + русские примеры
 *     (английские примеры скрыты)
 * Футер: инпут «Введите слово на английском» + круглая кнопка «Проверить».
 *
 * После ответа: блюр снимается, английское слово и примеры показываются
 * полностью, инпут окрашивается по результату (зелёный/жёлтый/красный).
 */
export function FreeRecall({
  questionKey,
  prompt,
  direction,
  transcription,
  audioWord,
  acceptableAnswers,
  feedback,
  disabled = false,
  meaningId,
  onAnswer,
  onTextSubmit,
  onSkip,
  showSkip = true,
  hideResultPanel = false,
  meanings,
  forms,
  onNext,
  gradeMode = false,
  onGrade,
}: FreeRecallProps) {
  const [inputValue, setInputValue] = useState('');
  const [localFeedback, setLocalFeedback] = useState<FreeRecallFeedback | null>(null);
  const [allMeaningsOpen, setAllMeaningsOpen] = useState(false);
  // Триггер анимации карточки. Сбрасываем через 400ms, чтобы при следующем
  // ответе того же типа анимация запустилась повторно (без remount LearningCard).
  const [animationKind, setAnimationKind] = useState<'shake' | 'nod' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeFeedback = feedback ?? localFeedback;
  const showResult = activeFeedback !== null;

  useEffect(() => {
    setInputValue('');
    setLocalFeedback(null);
    setAnimationKind(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(timer);
  }, [questionKey]);

  // Запускаем анимацию по результату; через 400ms (длиннее самой долгой
  // анимации — nod 0.4s) убираем класс, чтобы повторный wrong/correct
  // запустил её снова без remount.
  useEffect(() => {
    if (!activeFeedback) return;
    if (activeFeedback.result === 'wrong') setAnimationKind('shake');
    else if (activeFeedback.result === 'exact') setAnimationKind('nod');
    else setAnimationKind(null);
    const t = setTimeout(() => setAnimationKind(null), 450);
    return () => clearTimeout(t);
  }, [activeFeedback]);

  function handleSubmit() {
    if (showResult || disabled || !inputValue.trim()) return;
    onTextSubmit?.(inputValue.trim());
    const result = checkAnswer(inputValue, acceptableAnswers);
    const correctAnswer = acceptableAnswers[0] ?? '';
    setLocalFeedback({ result, correctAnswer });
    // ВАЖНО: не вызываем onAnswer сразу — даём юзеру посмотреть результат.
    // Переход к следующему вопросу происходит по клику на кнопку «дальше».
  }

  function handleNext() {
    if (!showResult || disabled) return;
    if (activeFeedback!.result === 'exact' || activeFeedback!.result === 'close') {
      onAnswer(meaningId);
    } else {
      onAnswer(null);
    }
    // Сразу подгружаем следующий вопрос. Для free-recall store настроен
    // skipFeedbackUpdate=true, поэтому автоматического таймера 1200мс нет.
    onNext?.();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showResult) {
        handleNext();
      } else {
        handleSubmit();
      }
    }
  }

  // direction='ru-en' (стандартный для L3): юзеру показывают русские переводы,
  // он вводит англ. слово. prompt — это, как правило, англ. слово (на L3 word-level
  // используется как стимул, но мы блюрим его до ответа).
  // direction='en-ru' — legacy meaning-level: показываем prompt без блюра.
  const isRuEn = direction === 'ru-en';
  const wordToShow = isRuEn ? (acceptableAnswers[0] ?? prompt) : prompt;

  const inputBorderClass = showResult
    ? activeFeedback.result === 'exact'
      ? 'border-[var(--green-9)]'
      : activeFeedback.result === 'close'
        ? 'border-[var(--amber-9)]'
        : 'border-[var(--red-9)]'
    : '';

  // Цвет кнопки «дальше» зеркалит результат: зелёный/жёлтый/красный.
  // До ответа — брендовая кнопка «Проверить».
  const nextButtonToneClass = !showResult
    ? 'bg-[var(--brand-9)] active:bg-[var(--brand-10)]'
    : activeFeedback.result === 'exact'
      ? 'bg-[var(--green-9)] active:bg-[var(--green-10)]'
      : activeFeedback.result === 'close'
        ? 'bg-[var(--amber-9)] active:bg-[var(--amber-10)]'
        : 'bg-[var(--red-9)] active:bg-[var(--red-10)]';

  const meaningsList: LearningCardMeaning[] = (meanings ?? []).map(toLearningMeaning);
  const blurActive = isRuEn && !showResult;

  // Цвет слова на L3 = индикатор результата. До ответа — белый.
  const wordColor = showResult
    ? activeFeedback.result === 'exact'
      ? 'var(--green-9)'
      : activeFeedback.result === 'close'
        ? 'var(--amber-9)'
        : 'var(--red-9)'
    : undefined;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Body */}
        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col p-4',
            animationKind === 'shake' && 'animate-shake',
            animationKind === 'nod' && 'animate-nod',
          )}
        >
          <LearningCard
            prompt={isRuEn ? 'Введите слово на английском' : 'Введите перевод'}
            word={wordToShow}
            transcription={transcription}
            meanings={meaningsList}
            blur={{ word: true, transcription: true, exampleEn: true, forms: true }}
            revealed={!blurActive}
            audioWord={audioWord ?? wordToShow}
            // На L3 active recall кнопка TTS видна только после ответа —
            // пока юзер не ввёл, аудио раскрыло бы слово.
            hideAudio={blurActive}
            onShowAll={() => setAllMeaningsOpen(true)}
            wordColor={wordColor}
            forms={forms ?? null}
            onShowForms={forms ? () => setAllMeaningsOpen(true) : undefined}
          />
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col gap-3 px-8 py-4">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              key={`input-${questionKey}`}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRuEn ? 'Введите слово на английском' : 'Введите перевод...'}
              disabled={showResult || disabled}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className={cn(
                'h-[52px] min-w-0 flex-1 rounded-full border-2 bg-[var(--gray-2)] px-5 transition-colors',
                inputBorderClass,
              )}
            />
            {/* В gradeMode после ответа стрелку «дальше» скрываем — переход
                идёт только через одну из 4 grade-кнопок ниже. */}
            {(!showResult || !gradeMode) && (
              <button
                type="button"
                onClick={showResult ? handleNext : handleSubmit}
                disabled={disabled || (!showResult && !inputValue.trim())}
                aria-label={showResult ? 'Следующее слово' : 'Проверить'}
                style={{ width: 52, height: 52, minWidth: 52, minHeight: 52, flexShrink: 0 }}
                className={cn(
                  'flex items-center justify-center rounded-full text-white transition-colors',
                  nextButtonToneClass,
                  'disabled:opacity-40',
                )}
              >
                <HugeiconsIcon
                  icon={showResult ? ArrowRight01Icon : Tick01Icon}
                  size={20}
                  strokeWidth={2}
                />
              </button>
            )}
          </div>

          {/* L3 grade-кнопки — рендерятся ПОСЛЕ ответа в gradeMode. */}
          {showResult && gradeMode && onGrade && (
            <div className="grid grid-cols-4 gap-2">
              <GradeButton label="Снова" tone="red" onClick={() => onGrade('again', inputValue.trim())} />
              <GradeButton label="Трудно" tone="amber" onClick={() => onGrade('hard', inputValue.trim())} />
              <GradeButton label="Хорошо" tone="brand" onClick={() => onGrade('good', inputValue.trim())} />
              <GradeButton label="Легко" tone="green" onClick={() => onGrade('easy', inputValue.trim())} />
            </div>
          )}

          {showSkip && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={showResult || disabled}
              style={{ height: 52, minHeight: 52 }}
              className="flex w-full items-center justify-center rounded-full px-5 text-sm font-medium text-[var(--gray-11)] transition-colors active:text-[var(--gray-12)] disabled:opacity-40"
            >
              Не знаю
            </button>
          )}
        </div>
      </div>

      {/* Bottom-sheet со всеми значениями. Дизайн повторяет CollectionsSheet:
          скругление 48px, встроенная кнопка закрытия скрыта — её роль играет
          круглая кнопка справа на уровне слова. LearningCard рендерится
          в flat-режиме (без своего фона) и наследует blur-конфиг основной
          карточки + значение revealed, чтобы magic-blur вёл себя одинаково. */}
      <Drawer open={allMeaningsOpen} onOpenChange={setAllMeaningsOpen}>
        <DrawerContent className="!max-h-[85vh] !rounded-t-[48px] [&>button[data-slot=drawer-close]]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{wordToShow}</DrawerTitle>
            <DrawerDescription>Все значения слова</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
            <LearningCard
              prompt=""
              hidePrompt
              word={wordToShow}
              transcription={transcription}
              meanings={meaningsList}
              blur={{ word: true, transcription: true, exampleEn: true, forms: true }}
              revealed={!blurActive}
              audioWord={audioWord ?? wordToShow}
              hideAudio={blurActive}
              hideShowAll
              flat
              wordColor={wordColor}
              forms={forms ?? null}
              formsDetailed
              wordRightSlot={
                <button
                  type="button"
                  onClick={() => setAllMeaningsOpen(false)}
                  aria-label="Закрыть"
                  className="flex size-11 items-center justify-center rounded-full bg-[var(--gray-3)] active:bg-[var(--gray-4)]"
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--gray-11)]" strokeWidth={2} />
                </button>
              }
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export type { FreeRecallFeedback, FreeRecallProps };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLearningMeaning(m: WordMeaningInfo): LearningCardMeaning {
  return {
    meaningId: m.meaningId,
    translation: m.translation,
    partOfSpeech: m.partOfSpeech,
    example: m.example ?? null,
  };
}

// ─── Grade button (L3 review) ────────────────────────────────────────────────

type GradeTone = 'red' | 'amber' | 'brand' | 'green';

function GradeButton({ label, tone, onClick }: { label: string; tone: GradeTone; onClick: () => void }) {
  const toneClass = {
    red:   'bg-[var(--red-9)]   active:bg-[var(--red-10)]',
    amber: 'bg-[var(--amber-9)] active:bg-[var(--amber-10)]',
    brand: 'bg-[var(--brand-9)] active:bg-[var(--brand-10)]',
    green: 'bg-[var(--green-9)] active:bg-[var(--green-10)]',
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center rounded-full px-2 py-3 text-xs font-medium text-white',
        toneClass,
      )}
    >
      {label}
    </button>
  );
}
