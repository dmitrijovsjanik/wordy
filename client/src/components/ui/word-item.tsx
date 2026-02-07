import { useState, useRef, useEffect, memo } from 'react';
import { Card } from '@/components/ui/card';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, Tick01Icon } from '@hugeicons/core-free-icons';

const POS_LABELS: Record<string, string> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  phrase: 'phrase',
};

type WordItemProps = {
  word: string;
  lemma?: string;
  transcription?: string;
  translations: string[];
  alternativeTranslations?: string[];
  partOfSpeech?: string;
  contextExample?: string;
  progress?: number; // 0.0-1.0, прогресс изучения слова
  onDelete?: () => Promise<void>;
  onClick?: () => void;
};

export const WordItem = memo(function WordItem({ word, lemma, transcription, translations, alternativeTranslations, partOfSpeech, contextExample, progress, onDelete, onClick }: WordItemProps) {
  // Если есть лемма — показываем её крупно, оригинальное слово мелко сверху
  // Если нет леммы — показываем оригинальное слово крупно
  const displayWord = lemma ?? word;
  const variantWord = lemma ? word : undefined;
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleFirstTap = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmVisible(true);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmVisible(false), 3000);
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setIsDeleting(true);
    try {
      await onDelete();
    } catch {
      setIsDeleting(false);
      setConfirmVisible(false);
    }
  };

  return (
    <Card
      className={`flex flex-col gap-1.5 p-4 ${onClick ? 'cursor-pointer active:bg-[var(--gray-3)]' : ''}`}
      onClick={onClick}
    >
      {/* Строка 1: слово + часть речи + SRS + удаление */}
      <div className="flex items-start gap-2">
        <div className="flex flex-col">
          {variantWord && (
            <span className="text-[10px] text-[var(--gray-10)]">{variantWord}</span>
          )}
          <span className="text-base font-semibold">{displayWord}</span>
          {transcription && (
            <span className="text-xs text-[var(--gray-10)]">[{transcription}]</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {partOfSpeech && (
            <span className="text-xs text-[var(--gray-9)]">
              {POS_LABELS[partOfSpeech] ?? partOfSpeech}
            </span>
          )}
          {progress !== undefined && progress > 0 && <ProgressRing progress={progress} />}
          {onDelete && (
            confirmVisible ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-[var(--red-11)]"
                onClick={handleConfirm}
                disabled={isDeleting}
              >
                <HugeiconsIcon icon={Tick01Icon} size={14} />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-[var(--gray-9)]"
                onClick={handleFirstTap}
                disabled={isDeleting}
              >
                <HugeiconsIcon icon={Delete02Icon} size={14} />
              </Button>
            )
          )}
        </div>
      </div>

      {/* Строка 2: переводы */}
      <div>
        <span className="text-sm text-[var(--gray-11)]">
          {translations.join(', ')}
        </span>
        {alternativeTranslations && alternativeTranslations.length > 0 && (
          <span className="text-xs text-[var(--gray-9)]">
            {' · '}{alternativeTranslations.join(', ')}
          </span>
        )}
      </div>

      {/* Строка 3: пример */}
      {contextExample && (
        <p className="text-xs italic text-[var(--gray-10)]">
          {contextExample}
        </p>
      )}
    </Card>
  );
});
