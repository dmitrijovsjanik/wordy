import { useState, useCallback, useRef } from 'react';
import type { CollectionWord } from '@/types/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ui/progress-ring';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon, Delete02Icon, Tick01Icon, Loading03Icon } from '@hugeicons/core-free-icons';
import { speakText, stopAudio } from '@/lib/tts';

const POS_LABELS: Record<string, string> = {
  noun: 'сущ.',
  verb: 'гл.',
  adj: 'прил.',
  adv: 'нареч.',
  phrase: 'фраза',
};

type WordDetailModalProps = {
  word: CollectionWord | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  canDelete?: boolean;
};

export function WordDetailModal({
  word,
  isOpen,
  onClose,
  onDelete,
  canDelete = false,
}: WordDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSpeak = useCallback(() => {
    if (!word) return;
    stopAudio();
    setTtsLoading(true);
    setTtsError(null);
    speakText(word.word, 0.9)
      .then(() => setTtsLoading(false))
      .catch((err) => {
        setTtsLoading(false);
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setTtsError('Ошибка озвучки');
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => setTtsError(null), 3000);
      });
  }, [word]);

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    handleConfirmDelete();
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setConfirmDelete(false);
      onClose();
    }
  };

  if (!word) return null;

  const displayWord = word.lemma ?? word.word;
  const variantWord = word.lemma ? word.word : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          {/* Слово + транскрипция + озвучивание */}
          <div className="flex items-start gap-3">
            <div className="flex flex-col">
              {variantWord && (
                <span className="text-xs text-[var(--gray-10)]">{variantWord}</span>
              )}
              <DialogTitle className="text-xl">{displayWord}</DialogTitle>
              {word.transcription && (
                <span className="text-sm text-[var(--gray-11)]">
                  [{word.transcription}]
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto shrink-0"
              onClick={handleSpeak}
              disabled={ttsLoading}
            >
              <HugeiconsIcon
                icon={ttsLoading ? Loading03Icon : VolumeHighIcon}
                size={20}
                className={ttsLoading ? 'animate-spin' : ''}
              />
            </Button>
          </div>
          {ttsError && (
            <p className="text-xs text-[var(--red-10)]">{ttsError}</p>
          )}
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Часть речи + SRS */}
          <div className="flex items-center gap-2">
            {word.partOfSpeech && (
              <Badge variant="secondary" className="text-xs uppercase">
                {POS_LABELS[word.partOfSpeech] ?? word.partOfSpeech}
              </Badge>
            )}
            {word.srsStage !== null && word.srsStage > 0 && (
              <ProgressRing progress={Math.min(word.srsStage, 3) / 3} />
            )}
          </div>

          {/* Основной перевод */}
          <div className="flex flex-col gap-1">
            <span className="text-base font-medium">{word.translation}</span>
            {word.alternativeTranslations && word.alternativeTranslations.length > 0 && (
              <span className="text-sm text-[var(--gray-11)]">
                {word.alternativeTranslations.join(', ')}
              </span>
            )}
          </div>

          {/* Синонимы */}
          {word.synonyms && word.synonyms.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--gray-10)] uppercase">
                Синонимы
              </span>
              <div className="flex flex-wrap gap-1">
                {word.synonyms.map((syn, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {syn}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Примеры */}
          {word.examples && word.examples.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[var(--gray-10)] uppercase">
                Примеры
              </span>
              <div className="flex flex-col gap-2">
                {word.examples.map((ex, i) => (
                  <div key={i} className="flex flex-col gap-0.5 rounded-lg bg-[var(--gray-3)] p-3">
                    <span className="text-sm">{ex.text}</span>
                    <span className="text-sm text-[var(--gray-11)]">{ex.translation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Контекстный пример (старый формат) */}
          {word.contextExample && !word.examples?.length && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--gray-10)] uppercase">
                Пример
              </span>
              <span className="text-sm italic text-[var(--gray-11)]">
                {word.contextExample}
              </span>
            </div>
          )}

          {/* Hints (уточнения контекста) */}
          {word.meaningHints && word.meaningHints.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--gray-10)] uppercase">
                Контекст
              </span>
              <span className="text-sm text-[var(--gray-11)]">
                {word.meaningHints.join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Кнопка удаления */}
        {canDelete && onDelete && (
          <DialogFooter>
            <Button
              variant={confirmDelete ? 'destructive' : 'ghost'}
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className="w-full"
            >
              <HugeiconsIcon icon={confirmDelete ? Tick01Icon : Delete02Icon} size={16} />
              {confirmDelete ? 'Подтвердить удаление' : 'Удалить из коллекции'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
