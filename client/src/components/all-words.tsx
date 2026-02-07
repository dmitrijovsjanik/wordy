import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Input } from '@/components/ui/input';
import { WordList } from '@/components/ui/word-list';
import { countUniqueWords } from '@/lib/word-utils';
import { WordViewToggle } from '@/components/ui/word-view-toggle';
import { WordSortSelect } from '@/components/ui/word-sort-select';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

export function AllWords() {
  const navigate = useNavigate();
  const allWords = useCollectionStore((s) => s.allWords);
  const isLoadingAllWords = useCollectionStore((s) => s.isLoadingAllWords);
  const fetchAllWords = useCollectionStore((s) => s.fetchAllWords);

  const [search, setSearch] = useState('');

  useBackButton(() => navigate('/collections'));

  useEffect(() => {
    fetchAllWords(true);
  }, [fetchAllWords]);

  const filteredWords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allWords;
    return allWords.filter(
      (w) =>
        w.word.toLowerCase().includes(query) ||
        w.translation.toLowerCase().includes(query),
    );
  }, [allWords, search]);

  if (isLoadingAllWords && allWords.length === 0) {
    return (
      <div className="flex flex-col px-4 pt-4 pb-4">
        <BackButton onClick={() => navigate('/collections')} />
        <Skeleton className="mt-4 h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
        <Skeleton className="mt-6 h-10 w-full" />
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col px-4 pt-4">
      {/* Header */}
      <BackButton onClick={() => navigate('/collections')} />

      <h1 className="mt-4 text-xl font-bold">Все слова</h1>

      {/* Word list */}
      <div className="mt-6 flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--gray-11)]">{countUniqueWords(filteredWords)} слов</span>
          <div className="flex items-center gap-2">
            <WordSortSelect />
            <WordViewToggle />
          </div>
        </div>

        {filteredWords.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--gray-11)]">
            {search ? 'Ничего не найдено' : 'Нет слов. Добавьте коллекции в библиотеку!'}
          </p>
        ) : (
          <WordList words={filteredWords} />
        )}
      </div>

      {/* Search input — sticky bottom */}
      <div className="pointer-events-none sticky bottom-0 -mx-4">
        <div className="h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
        <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pb-4">
          <div className="relative">
            <HugeiconsIcon
              icon={Search01Icon}
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gray-11)]"
            />
            <Input
              placeholder="Поиск слов..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-11 pr-11"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--gray-11)] active:text-[var(--gray-12)]"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={18} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
