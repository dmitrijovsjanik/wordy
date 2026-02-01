import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';

type WordRow = {
  wordText: string;
  translation: string;
};

export function CollectionEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDetail, isLoading, fetchDetail, update } = useCollectionStore();

  useBackButton(() => navigate(`/collections/${id}`));

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<WordRow[]>([{ wordText: '', translation: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [removingIndices, setRemovingIndices] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const prevRowCount = useRef(0);
  const [initialTitle, setInitialTitle] = useState('');
  const [initialDescription, setInitialDescription] = useState('');
  const [initialWords, setInitialWords] = useState<WordRow[]>([]);

  useEffect(() => {
    if (id) fetchDetail(Number(id));
  }, [id, fetchDetail]);

  useEffect(() => {
    if (currentDetail && !initialized) {
      const t = currentDetail.collection.title;
      const d = currentDetail.collection.description ?? '';
      const existing: WordRow[] = currentDetail.words.map((w) => ({
        wordText: w.word,
        translation: w.translation,
      }));

      setTitle(t);
      setDescription(d);
      setRows([...existing, { wordText: '', translation: '' }]);
      setInitialTitle(t);
      setInitialDescription(d);
      setInitialWords(existing);
      prevRowCount.current = existing.length + 1;
      setInitialized(true);
    }
  }, [currentDetail, initialized]);

  useEffect(() => {
    if (initialized) {
      prevRowCount.current = rows.length;
    }
  }, [rows.length, initialized]);

  const updateRow = (index: number, field: keyof WordRow, value: string) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, [field]: value } : r));
      if (index === next.length - 1 && field === 'translation' && value.length > 0) {
        next.push({ wordText: '', translation: '' });
      }
      if (
        next.length > 1 &&
        !next[next.length - 1]!.wordText &&
        !next[next.length - 1]!.translation &&
        !next[next.length - 2]!.wordText &&
        !next[next.length - 2]!.translation
      ) {
        next.pop();
      }
      return next;
    });
  };

  const removeRow = (index: number) => {
    setRemovingIndices((prev) => new Set(prev).add(index));
    setTimeout(() => {
      setRows((prev) => {
        const next = prev.filter((_, i) => i !== index);
        if (next.length === 0) next.push({ wordText: '', translation: '' });
        return next;
      });
      setRemovingIndices((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 250);
  };

  const filledWords = rows.filter((r) => r.wordText.trim() && r.translation.trim());

  const hasChanges =
    title !== initialTitle ||
    description !== initialDescription ||
    JSON.stringify(filledWords) !== JSON.stringify(initialWords);

  const handleSave = async () => {
    if (!title.trim() || !id) return;
    setIsSaving(true);
    try {
      await update(Number(id), {
        title: title.trim(),
        description: description.trim() || undefined,
        words: filledWords,
      });
      navigate(`/collections/${id}`);
    } catch {
      setIsSaving(false);
    }
  };

  if (isLoading || !currentDetail) {
    return (
      <div className="flex flex-col px-4 pt-4 pb-4">
        <BackButton onClick={() => navigate(`/collections/${id}`)} />
        <Skeleton className="mt-4 h-8 w-48" />
        <Skeleton className="mt-4 h-14 w-full rounded-full" />
        <Skeleton className="mt-2 h-14 w-full rounded-full" />
        <Skeleton className="mt-6 h-6 w-24" />
        <Skeleton className="mt-2 h-14 w-full rounded-full" />
        <Skeleton className="mt-2 h-14 w-full rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-4">
      <BackButton onClick={() => navigate(`/collections/${id}`)} />

      <h1 className="mt-4 text-xl font-bold">Редактировать</h1>

      <Input
        placeholder="Название"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mt-4"
      />

      <Input
        placeholder="Описание (необязательно)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mt-2"
      />

      <h2 className="mt-6 text-sm font-semibold">Слова ({filledWords.length})</h2>

      <div className="mt-2 flex flex-1 flex-col gap-2">
        {rows.map((row, i) => {
          const isFilled = row.wordText.trim() || row.translation.trim();
          const isNew = i >= prevRowCount.current;
          const isRemoving = removingIndices.has(i);
          return (
            <div key={i} className={`flex items-center gap-2${isNew ? ' animate-slide-down-in' : ''}${isRemoving ? ' animate-slide-up-out' : ''}`}>
              <Input
                placeholder="Слово (en)"
                value={row.wordText}
                onChange={(e) => updateRow(i, 'wordText', e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="Перевод (ru)"
                value={row.translation}
                onChange={(e) => updateRow(i, 'translation', e.target.value)}
                className="flex-1"
              />
              <button
                onClick={() => removeRow(i)}
                disabled={!isFilled}
                className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[var(--red-9)] transition-opacity duration-200 ${isFilled ? 'opacity-100 animate-fade-in' : 'opacity-0 pointer-events-none'}`}
              >
                <HugeiconsIcon icon={Delete02Icon} size={18} />
              </button>
            </div>
          );
        })}
      </div>

      <Button
        disabled={!title.trim() || !hasChanges || isSaving}
        onClick={handleSave}
        className="mt-4"
      >
        Сохранить
      </Button>
    </div>
  );
}
