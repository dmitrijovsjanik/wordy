import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { WordList } from '@/components/ui/word-list';
import { countUniqueWords } from '@/lib/word-utils';
import { WordViewToggle } from '@/components/ui/word-view-toggle';
import { WordSortSelect } from '@/components/ui/word-sort-select';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { ERRORS_COLLECTION_ID } from '@/lib/api';
import { useHomeStore } from '@/stores/home-store';

export function ErrorsCollection() {
  const navigate = useNavigate();
  const errorsCollection = useCollectionStore((s) => s.errorsCollection);
  const isLoadingErrors = useCollectionStore((s) => s.isLoadingErrors);
  const fetchErrorsCollection = useCollectionStore((s) => s.fetchErrorsCollection);
  const setCollectionId = useHomeStore((s) => s.setCollectionId);

  useBackButton(() => navigate('/collections'));

  useEffect(() => {
    fetchErrorsCollection(true);
  }, [fetchErrorsCollection]);

  if (isLoadingErrors || !errorsCollection) {
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

  const { collection, words, totalWords } = errorsCollection;

  // Преобразуем слова в формат WordList
  const wordListItems = words.map((w) => ({
    id: w.meaningId,
    word: w.word,
    translation: w.translation,
    srsStage: w.srsStage,
  }));

  return (
    <div className="flex min-h-full flex-col px-4 pt-4">
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigate('/collections')} />
      </div>

      {/* Инфо */}
      <h1 className="mt-4 text-xl font-bold">{collection.title}</h1>
      {collection.description && (
        <p className="mt-1 text-sm text-[var(--gray-11)]">{collection.description}</p>
      )}

      {/* Список слов */}
      <div className="mt-6 flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--gray-11)]">{countUniqueWords(wordListItems)} слов</span>
          <div className="flex items-center gap-2">
            <WordSortSelect />
            <WordViewToggle />
          </div>
        </div>
        {totalWords === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--gray-11)]">
            Нет слов с ошибками. Отлично!
          </p>
        ) : (
          <WordList words={wordListItems} />
        )}
      </div>

      {/* Нижняя панель */}
      {totalWords > 0 && (
        <div className="pointer-events-none sticky bottom-0 -mx-4">
          <div className="h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
          <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pb-4">
            <Button
              onClick={() => {
                setCollectionId(ERRORS_COLLECTION_ID);
                navigate('/');
              }}
              className="w-full"
            >
              Повторить ошибки
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
