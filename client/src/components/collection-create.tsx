import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BackButton } from '@/components/ui/back-button';
import { DictionaryPreview } from '@/components/ui/dictionary-preview';
import { WordList } from '@/components/ui/word-list';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { dictionaryLookup, addCollectionWords } from '@/lib/api';
import type { DictionaryLookupResult } from '@/types/api';

type AddedWord = {
  id: number;
  word: string;
  translation: string;
  partOfSpeech?: string;
  srsStage: number;
};

export function CollectionCreate() {
  const navigate = useNavigate();
  const { create } = useCollectionStore();

  useBackButton(() => navigate('/collections'));

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [createdId] = useState<number | null>(null);

  // Dictionary lookup state
  const [query, setQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<DictionaryLookupResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Words added so far
  const [words, setWords] = useState<AddedWord[]>([]);
  const [nextLocalId, setNextLocalId] = useState(1);

  // Debounced dictionary lookup
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setLookupResult(null);
      setIsLookingUp(false);
      return;
    }

    setIsLookingUp(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await dictionaryLookup(trimmed);
        setLookupResult(result);
      } catch {
        setLookupResult(null);
      } finally {
        setIsLookingUp(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const existingMeaningIds = useMemo(
    () => new Set(words.map((w) => w.id)),
    [words],
  );

  const handleAdd = useCallback(
    async (
      meaningIds: number[],
      custom?: { wordText: string; translation: string },
    ) => {
      if (createdId) {
        // Collection already created — add via API
        setIsAdding(true);
        try {
          await addCollectionWords(createdId, {
            meaningIds: meaningIds.length > 0 ? meaningIds : undefined,
            custom: custom ? [custom] : undefined,
          });
        } catch {
          setIsAdding(false);
          return;
        }
        setIsAdding(false);
      }

      // Add to local word list
      if (lookupResult && meaningIds.length > 0) {
        const newWords: AddedWord[] = lookupResult.meanings
          .filter((m) => m.id !== null && meaningIds.includes(m.id))
          .map((m) => ({
            id: m.id!,
            word: lookupResult.word,
            translation: m.translation,
            partOfSpeech: m.partOfSpeech,
            srsStage: 0,
          }));
        setWords((prev) => [...prev, ...newWords.filter((nw) => !prev.some((p) => p.id === nw.id))]);
      } else if (custom) {
        setWords((prev) => [
          ...prev,
          {
            id: -nextLocalId,
            word: custom.wordText,
            translation: custom.translation,
            srsStage: 0,
          },
        ]);
        setNextLocalId((n) => n + 1);
      }

      setQuery('');
      setLookupResult(null);
      inputRef.current?.focus();
    },
    [createdId, lookupResult, nextLocalId],
  );

  const handleSave = async () => {
    if (!title.trim()) return;
    setIsSaving(true);
    try {
      // Separate system meanings and custom words
      const systemMeaningIds = words.filter((w) => w.id > 0).map((w) => w.id);
      const customWords = words
        .filter((w) => w.id < 0)
        .map((w) => ({ wordText: w.word, translation: w.translation }));

      const id = await create({
        title: title.trim(),
        description: description.trim() || undefined,
        words: customWords.length > 0 ? customWords : undefined,
      });

      // Add system words if any
      if (systemMeaningIds.length > 0) {
        await addCollectionWords(id, { meaningIds: systemMeaningIds });
      }

      navigate('/collections');
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col px-4 pt-4">
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

      {/* Word list */}
      <div className="mt-6 flex flex-1 flex-col gap-2">
        <span className="text-sm text-[var(--gray-11)]">
          {words.length > 0 ? `${words.length} слов` : 'Нет слов'}
        </span>

        {words.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--gray-11)]">
            Введите слово в поле ниже, чтобы добавить
          </p>
        )}

        <WordList words={words} />
      </div>

      {/* Bottom panel */}
      <div className="pointer-events-none sticky bottom-0 -mx-4">
        <div className="h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
        <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pb-4">
          <div className="flex flex-col gap-3">
            {/* Dictionary preview */}
            <DictionaryPreview
              result={lookupResult}
              isLoading={isLookingUp}
              query={query}
              existingMeaningIds={existingMeaningIds}
              onAdd={handleAdd}
            />

            {/* Search input */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <HugeiconsIcon
                  icon={Search01Icon}
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gray-11)]"
                />
                <Input
                  ref={inputRef}
                  placeholder="Введите слово..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-11 pr-11"
                  disabled={isAdding}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setLookupResult(null);
                      inputRef.current?.focus();
                    }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--gray-11)] active:text-[var(--gray-12)]"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={18} />
                  </button>
                )}
              </div>
            </div>

            {/* Save button */}
            <Button
              disabled={!title.trim() || words.length === 0 || isSaving}
              onClick={handleSave}
              className="w-full"
            >
              Сохранить
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
