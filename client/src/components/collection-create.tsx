import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackButton } from '@/components/ui/back-button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon } from '@hugeicons/core-free-icons';

type WordRow = {
  wordText: string;
  translation: string;
};

export function CollectionCreate() {
  const navigate = useNavigate();
  const { create } = useCollectionStore();

  useBackButton(() => navigate('/collections'));

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<WordRow[]>([{ wordText: '', translation: '' }]);
  const [isSaving, setIsSaving] = useState(false);
  const [removingIndices, setRemovingIndices] = useState<Set<number>>(new Set());
  const prevRowCount = useRef(rows.length);

  useEffect(() => {
    prevRowCount.current = rows.length;
  }, [rows.length]);

  const updateRow = (index: number, field: keyof WordRow, value: string) => {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === index ? { ...r, [field]: value } : r));
      // Если редактируем последнюю строку и в поле перевода есть символ — добавляем новую пустую
      const last = next[next.length - 1]!;
      if (index === next.length - 1 && field === 'translation' && value.length > 0) {
        next.push({ wordText: '', translation: '' });
      }
      // Если последние 2 строки пустые — убираем лишнюю
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

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      await create({
        title: title.trim(),
        description: description.trim() || undefined,
        words: filledWords,
      });
      navigate('/collections');
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col px-4 pt-4 pb-4">
      <BackButton onClick={() => navigate('/collections')} />

      <h1 className="mt-4 text-xl font-bold">Новая коллекция</h1>

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
        disabled={!title.trim() || filledWords.length === 0 || isSaving}
        onClick={handleSave}
        className="mt-4"
      >
        Сохранить
      </Button>
    </div>
  );
}
