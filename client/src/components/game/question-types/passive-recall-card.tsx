import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ViewIcon, Cancel01Icon } from '@hugeicons/core-free-icons';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { LearningCard, type LearningCardMeaning } from '@/components/game/learning-card';
import { cn } from '@/lib/utils';
import type { PassiveRecallApiQuestion, WordMeaningInfo } from '@/types/api';

type PassiveRecallCardProps = {
  question: PassiveRecallApiQuestion;
  disabled?: boolean;
  /** Вызывается после короткого ✓/✗ feedback (500ms). knew=true → правильно. */
  onAnswer: (knew: boolean) => void;
};

// Overlay убран — переход моментальный, как у pool-card.
const FEEDBACK_MS = 0;

/**
 * Passive recall — L2-карточка (tier=passive). Дизайн Wordy 2.2 (Figma 5123:7411).
 *
 * Одна карточка без flip. Видно: англ. слово, транскрипция, англ. примеры,
 * часть речи. В магических частицах: русские переводы и русские предложения
 * примеров.
 *
 * Кнопка-«глазик» в футере: hold-to-reveal. Пока палец нажат — частицы
 * собираются (видно перевод). Отпустил — снова рассыпаются.
 *
 * Кнопки «Не помню» / «Помню» вызывают ✓/✗ overlay 500мс → onAnswer(knew).
 */
export function PassiveRecallCard({ question, disabled = false, onAnswer }: PassiveRecallCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [decision, setDecision] = useState<'known' | 'unknown' | null>(null);
  const [allMeaningsOpen, setAllMeaningsOpen] = useState(false);

  useEffect(() => {
    if (decision === null) return;
    const t = setTimeout(() => onAnswer(decision === 'known'), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [decision, onAnswer]);

  const canAnswer = decision === null && !disabled;

  const meaningsRaw: WordMeaningInfo[] = question.meanings ?? [{
    meaningId: question.meaningId,
    translation: question.translation,
    example: question.example,
    partOfSpeech: 'noun',
  }];
  const meanings: LearningCardMeaning[] = meaningsRaw.map(toLearningMeaning);

  // Hold-to-reveal handlers для кнопки-глазика.
  const holdStart = () => canAnswer && setRevealed(true);
  const holdEnd = () => setRevealed(false);

  // Без визуального overlay поверх карточки — переход моментальный.

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col p-4">
          <LearningCard
            prompt="Вспомните перевод и проверьте себя"
            word={question.word}
            transcription={question.transcription}
            meanings={meanings}
            blur={{ translation: true, exampleRu: true }}
            revealed={revealed}
            audioWord={question.word}
            onShowAll={() => setAllMeaningsOpen(true)}
            forms={question.forms ?? null}
            onShowForms={question.forms ? () => setAllMeaningsOpen(true) : undefined}
          />
        </div>

        {/* Footer: [Не помню][👁 hold-to-reveal][Помню] */}
        <div className="flex items-center gap-2 px-8 py-4">
          <button
            type="button"
            onClick={() => canAnswer && setDecision('unknown')}
            disabled={!canAnswer}
            className={cn(
              'flex flex-1 items-center justify-center rounded-full bg-[var(--red-9)] px-4 py-4 text-sm font-medium text-white',
              'active:bg-[var(--red-10)] disabled:opacity-40',
            )}
          >
            Не помню
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              holdStart();
            }}
            onPointerUp={holdEnd}
            onPointerLeave={holdEnd}
            onPointerCancel={holdEnd}
            disabled={!canAnswer}
            aria-label="Показать переводы (удерживайте)"
            aria-pressed={revealed}
            className={cn(
              'flex size-[52px] shrink-0 items-center justify-center rounded-full transition-colors',
              revealed ? 'bg-[var(--brand-3)]' : 'bg-[var(--gray-3)]',
              'active:bg-[var(--gray-4)] disabled:opacity-40 select-none touch-none',
            )}
          >
            <HugeiconsIcon
              icon={ViewIcon}
              size={20}
              className={revealed ? 'text-[var(--brand-11)]' : 'text-[var(--gray-11)]'}
              strokeWidth={2}
            />
          </button>
          <button
            type="button"
            onClick={() => canAnswer && setDecision('known')}
            disabled={!canAnswer}
            className={cn(
              'flex flex-1 items-center justify-center rounded-full bg-[var(--green-9)] px-4 py-4 text-sm font-medium text-white',
              'active:bg-[var(--green-10)] disabled:opacity-40',
            )}
          >
            Помню
          </button>
        </div>
      </div>

      {/* Bottom-sheet со всеми значениями. Дизайн повторяет L3 (free-recall):
          скругление 48px, встроенная кнопка закрытия скрыта — её роль играет
          круглая кнопка справа на уровне слова. LearningCard рендерится
          в flat-режиме (без своего фона) и с раскрытым revealed. */}
      <Drawer open={allMeaningsOpen} onOpenChange={setAllMeaningsOpen}>
        <DrawerContent className="!max-h-[85vh] !rounded-t-[48px] [&>button[data-slot=drawer-close]]:hidden">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{question.word}</DrawerTitle>
            <DrawerDescription>Все значения слова</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-4">
            <LearningCard
              prompt=""
              hidePrompt
              word={question.word}
              transcription={question.transcription}
              meanings={meanings}
              revealed
              audioWord={question.word}
              hideShowAll
              flat
              forms={question.forms ?? null}
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLearningMeaning(m: WordMeaningInfo): LearningCardMeaning {
  return {
    meaningId: m.meaningId,
    translation: m.translation,
    partOfSpeech: m.partOfSpeech,
    example: m.example ?? null,
  };
}
