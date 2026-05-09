import { useState } from 'react';
import { motion } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { BulbIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { learningMnemonicRevealed } from '@/lib/api';
import type { EncounterCardApiQuestion, WordMeaningInfo, WordFormsInfo } from '@/types/api';
import { HighlightedSentence, WordFormsList } from '../word-forms-display';

type EncounterCardProps = {
  question: EncounterCardApiQuestion;
  disabled?: boolean;
  /** Вызывается при клике «Понятно». Без валидации. */
  onAnswer: (answer: string) => void;
};

const CARD_SHADOW = 'shadow-[0_10px_30px_-5px_rgba(0,0,0,0.18)]';

/**
 * Encounter — карточка-знакомство (L1, word-level). Флешкарта max-w-sm × h-[60vh]
 * с 3D-флипом по тапу.
 *
 *   Лицо:     слово + transcription + индикатор «N значений»
 *   Обратная: список всех значений со переводами и примерами
 *
 * Если сервер не вернул meanings (backward compat — старая версия), рендерим
 * single-meaning layout: только translation/example representative meaning'а.
 */
export function EncounterCard({ question, disabled = false, onAnswer }: EncounterCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [mnemonicOpen, setMnemonicOpen] = useState(false);

  const handleMnemonicReveal = () => {
    setMnemonicOpen(true);
    learningMnemonicRevealed(question.meaningId).catch(() => {});
  };

  // Word-level: используем meanings[]. Backward compat: если undefined — один meaning.
  const meanings: WordMeaningInfo[] = question.meanings ?? [{
    meaningId: question.meaningId,
    translation: question.translation,
    example: question.example,
    partOfSpeech: question.partOfSpeech,
  }];
  const meaningCount = meanings.length;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div className="relative h-[60vh] w-full" style={{ perspective: 1200 }}>
          <motion.div
            onClick={() => setFlipped((f) => !f)}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 cursor-pointer"
          >
            <motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.45, ease: 'easeInOut' }}
              style={{ transformStyle: 'preserve-3d' }}
              className="relative h-full w-full"
            >
              {/* Лицо: слово + transcription + N значений + формы */}
              <FrontFace
                word={question.word}
                transcription={question.transcription}
                meaningCount={meaningCount}
                forms={question.forms ?? null}
              />

              {/* Обратная: список значений */}
              <BackFace meanings={meanings} forms={question.forms ?? null} />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Кнопочный ряд снизу. */}
      <div className={`mt-4 grid gap-2 ${question.mnemonic ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {question.mnemonic && (
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={handleMnemonicReveal}
            className="gap-1.5 text-xs"
          >
            <HugeiconsIcon icon={BulbIcon} size={16} />
            Подсказка
          </Button>
        )}
        <Button
          variant="default"
          disabled={disabled}
          onClick={() => onAnswer('understood')}
          className="text-xs"
        >
          Понятно
        </Button>
      </div>

      {question.mnemonic && (
        <Drawer open={mnemonicOpen} onOpenChange={setMnemonicOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Подсказка для запоминания</DrawerTitle>
            </DrawerHeader>
            <div className="px-6 pb-8 text-base text-[var(--gray-12)]">
              {question.mnemonic}
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

// ─── Front: слово + transcription + N значений ──────────────────────────────

type FrontFaceProps = {
  word: string;
  transcription: string | null;
  meaningCount: number;
  forms: WordFormsInfo | null;
};

function FrontFace({ word, transcription, meaningCount, forms }: FrontFaceProps) {
  return (
    <Card
      className={`absolute inset-0 flex flex-col gap-4 overflow-hidden px-6 py-8 text-center ${CARD_SHADOW}`}
      style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
    >
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        {meaningCount > 1 && (
          <div className="text-xs uppercase tracking-wide text-[var(--gray-11)]">
            {meaningCount} {pluralizeMeanings(meaningCount)}
          </div>
        )}
        <div className="text-3xl font-bold text-[var(--gray-12)]">{word}</div>
        {transcription && (
          <div className="text-sm text-[var(--gray-11)]">[{transcription}]</div>
        )}
        {forms && forms.forms.length > 1 && (
          <div className="mt-3 max-w-full px-2">
            <WordFormsList forms={forms} hideBase />
          </div>
        )}
      </div>
      <div className="text-xs text-[var(--gray-10)]">Тапните, чтобы увидеть переводы</div>
    </Card>
  );
}

// ─── Back: список значений ──────────────────────────────────────────────────

function BackFace({ meanings, forms }: { meanings: WordMeaningInfo[]; forms: WordFormsInfo | null }) {
  const formList = forms?.forms ?? [];
  return (
    <Card
      className={`absolute inset-0 flex flex-col gap-3 overflow-hidden px-6 py-8 ${CARD_SHADOW}`}
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
      }}
    >
      <div className="flex-1 overflow-y-auto">
        {meanings.length === 1 ? (
          // Один meaning — крупное центрированное отображение.
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="text-3xl font-bold text-[var(--gray-12)]">{meanings[0]!.translation}</div>
            {meanings[0]!.example && (
              <div className="mt-2 text-sm text-[var(--gray-11)]">
                <HighlightedSentence sentence={meanings[0]!.example.en} forms={formList} />
              </div>
            )}
            {meanings[0]!.example && (
              <div className="text-sm text-[var(--gray-10)]">{meanings[0]!.example.ru}</div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3 text-left">
            {meanings.map((m, idx) => (
              <div
                key={m.meaningId}
                className={idx > 0 ? 'border-t border-[var(--gray-5)] pt-3' : ''}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-[var(--gray-10)]">{idx + 1}.</span>
                  <span className="text-base font-semibold text-[var(--gray-12)]">{m.translation}</span>
                </div>
                {m.example && (
                  <div className="mt-1 ml-5 text-sm text-[var(--gray-11)]">
                    <HighlightedSentence sentence={m.example.en} forms={formList} />
                  </div>
                )}
                {m.example && (
                  <div className="ml-5 text-xs text-[var(--gray-10)]">{m.example.ru}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function pluralizeMeanings(n: number): string {
  // Русская плюрализация: 1 значение, 2-4 значения, 5+ значений
  const last2 = n % 100;
  const lastDigit = n % 10;
  if (last2 >= 11 && last2 <= 14) return 'значений';
  if (lastDigit === 1) return 'значение';
  if (lastDigit >= 2 && lastDigit <= 4) return 'значения';
  return 'значений';
}
