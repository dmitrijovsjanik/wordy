import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
 */
export function EncounterCard({ question, disabled = false, onAnswer }: EncounterCardProps) {
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
        <Card className="flex flex-col gap-1 px-4 py-3 bg-[var(--amber-3)]">
          <span className="text-xs uppercase tracking-wide text-[var(--amber-11)]">Запоминалка</span>
          <div className="text-sm text-[var(--amber-12)]">{question.mnemonic}</div>
        </Card>
      )}

      <Button
        disabled={disabled}
        onClick={() => onAnswer('understood')}
        className="mt-2 h-14"
      >
        Понятно
      </Button>
    </div>
  );
}
