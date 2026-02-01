import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { WordItem } from '@/components/ui/word-item';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDetail, isLoading, fetchDetail, subscribe, unsubscribe } = useCollectionStore();

  useBackButton(() => navigate('/collections'));

  useEffect(() => {
    if (id) fetchDetail(Number(id));
  }, [id, fetchDetail]);

  if (isLoading || !currentDetail) {
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

  const { collection, words } = currentDetail;
  const isOwner = collection.type === 'user';

  return (
    <div className="flex min-h-full flex-col px-4 pt-4">
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigate('/collections')} />
        {isOwner && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate(`/collections/${collection.id}/edit`)}
          >
            Редактировать
          </Button>
        )}
      </div>

      <h1 className="mt-4 text-xl font-bold">{collection.title}</h1>
      {collection.description && (
        <p className="mt-1 text-sm text-[var(--gray-11)]">{collection.description}</p>
      )}
      <p className="mt-1 text-xs text-[var(--gray-11)]">
        {collection.totalWords} слов
        {collection.price ? ` · ${collection.price} ₽` : ''}
      </p>

      {/* Words list */}
      <div className="mt-6 flex flex-1 flex-col gap-2">
        {words.length === 0 && (
          <p className="text-center text-sm text-[var(--gray-11)]">Нет слов</p>
        )}
        {words.map((w) => (
          <WordItem key={w.id} word={w.word} translation={w.translation} />
        ))}
      </div>

      <div className="pointer-events-none sticky bottom-0 -mx-4">
        <div className="h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
        <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pb-4">
          {collection.isInLibrary ? (
            <Button
              variant="secondary"
              onClick={() => unsubscribe(collection.id)}
              className="w-full"
            >
              Удалить из библиотеки
            </Button>
          ) : (
            <Button
              onClick={() => subscribe(collection.id)}
              className="w-full"
            >
              Добавить в библиотеку
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
