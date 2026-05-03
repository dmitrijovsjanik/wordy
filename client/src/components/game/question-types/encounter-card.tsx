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
import type { EncounterCardApiQuestion } from '@/types/api';

type EncounterCardProps = {
  question: EncounterCardApiQuestion;
  disabled?: boolean;
  /** Вызывается при клике «Понятно». Без валидации. */
  onAnswer: (answer: string) => void;
};

const CARD_SHADOW = 'shadow-[0_10px_30px_-5px_rgba(0,0,0,0.18)]';

/**
 * Encounter — карточка-знакомство (L1 в лестнице). Визуал и компоновка
 * совпадают с PassiveRecallCard (L2): флешкарта max-w-sm × h-[60vh] с
 * 3D-флипом по тапу, кнопочный ряд снизу.
 *
 *   Лицо:     слово   + transcription + example.en + «N/M»
 *   Обратная: перевод + example.ru + «N/M»
 *
 * Свайпа нет (нет самооценки на L1). Снизу: «Подсказка для запоминания»
 * (если есть мнемоника) + «Понятно». Раскрытие мнемоники логируется
 * для аналитики (mnemonic_revealed).
 */
export function EncounterCard({ question, disabled = false, onAnswer }: EncounterCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [mnemonicOpen, setMnemonicOpen] = useState(false);

  const handleMnemonicReveal = () => {
    setMnemonicOpen(true);
    learningMnemonicRevealed(question.meaningId).catch(() => {});
  };

  const showMeaningIndex = question.totalMeanings > 1;

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
              {/* Лицо */}
              <FaceCard
                meaningIndex={question.meaningIndex}
                totalMeanings={question.totalMeanings}
                showMeaningIndex={showMeaningIndex}
                mainText={question.word}
                subText={question.transcription ? `[${question.transcription}]` : null}
                exampleText={question.example?.en ?? null}
                backFace={false}
              />

              {/* Обратная */}
              <FaceCard
                meaningIndex={question.meaningIndex}
                totalMeanings={question.totalMeanings}
                showMeaningIndex={showMeaningIndex}
                mainText={question.translation}
                subText={null}
                exampleText={question.example?.ru ?? null}
                backFace
              />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Кнопочный ряд — то же место что у L2 (Учить/Знаю). */}
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

// ─── FaceCard — один из двух «листов» (идентично PassiveRecallCard) ────────

type FaceCardProps = {
  meaningIndex: number;
  totalMeanings: number;
  showMeaningIndex: boolean;
  mainText: string;
  subText: string | null;
  exampleText: string | null;
  backFace: boolean;
};

function FaceCard({ meaningIndex, totalMeanings, showMeaningIndex, mainText, subText, exampleText, backFace }: FaceCardProps) {
  return (
    <Card
      className={`absolute inset-0 flex flex-col gap-4 overflow-hidden px-6 py-8 text-center ${CARD_SHADOW}`}
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        ...(backFace ? { transform: 'rotateY(180deg)' } : {}),
      }}
    >
      <div className="relative flex flex-1 flex-col items-center justify-center gap-2">
        {showMeaningIndex && (
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--gray-11)]">
            <span>{meaningIndex} / {totalMeanings}</span>
          </div>
        )}
        <div className="text-3xl font-bold">{mainText}</div>
        {subText && (
          <div className="text-sm text-[var(--gray-11)]">{subText}</div>
        )}
      </div>

      {exampleText && (
        <div className="relative border-t border-[var(--gray-5)] pt-3 text-left">
          <div className="text-sm">{exampleText}</div>
        </div>
      )}
    </Card>
  );
}
