import { useState } from 'react';
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
  onAnswer: (answer: string) => void;
};

/**
 * Encounter — карточка-знакомство (первый уровень лестницы освоения).
 * Без проверки ответа: пользователь читает слово+перевод, видит контекст,
 * нажимает «Понятно» → сервер засчитывает 1 показ → tier=passive.
 *
 * Мнемоника спрятана под кнопкой «Подсказка». Качество AI-мнемоник
 * неровное, пользователь сам решает — нужна ли подсказка. Раскрытие
 * логируется как событие mnemonic_revealed для оценки полезности
 * AI-контента.
 */
export function EncounterCard({ question, disabled = false, onAnswer }: EncounterCardProps) {
  const [mnemonicOpen, setMnemonicOpen] = useState(false);

  const handleMnemonicReveal = () => {
    setMnemonicOpen(true);
    // fire-and-forget: аналитика не должна блокировать UI.
    learningMnemonicRevealed(question.meaningId).catch(() => {});
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="flex flex-col items-center gap-3 px-4 py-6 text-center">
        <span className="text-xs uppercase tracking-wide text-[var(--gray-11)]">
          Новое слово
        </span>
        <div className="text-3xl font-bold">{question.word}</div>
        {question.transcription && (
          <div className="text-sm text-[var(--gray-11)]">[{question.transcription}]</div>
        )}
        <div className="mt-2 text-lg text-[var(--gray-12)]">{question.translation}</div>
      </Card>

      {question.example && (
        <Card className="flex flex-col gap-1 px-4 py-3">
          <span className="text-xs uppercase tracking-wide text-[var(--gray-11)]">Пример</span>
          <div className="text-sm">{question.example.en}</div>
          <div className="text-sm text-[var(--gray-11)]">{question.example.ru}</div>
        </Card>
      )}

      {question.mnemonic && (
        <Button
          variant="secondary"
          onClick={handleMnemonicReveal}
          className="gap-2"
        >
          <HugeiconsIcon icon={BulbIcon} size={18} />
          Подсказка для запоминания
        </Button>
      )}

      <Button
        disabled={disabled}
        onClick={() => onAnswer('understood')}
        className="mt-2 h-14"
      >
        Понятно
      </Button>

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
