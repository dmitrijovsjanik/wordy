import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WordList } from '@/components/ui/word-list';
import { WordViewToggle } from '@/components/ui/word-view-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { DictionaryPreview } from '@/components/ui/dictionary-preview';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  MoreVerticalIcon,
  Add01Icon,
  Tick01Icon,
  Delete02Icon,
  Edit02Icon,
  Search01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { dictionaryLookup, addCollectionWords } from '@/lib/api';
import { useHomeStore } from '@/stores/home-store';
import type { DictionaryLookupResult } from '@/types/api';

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDetail, isLoading, fetchDetail, subscribe, unsubscribe, remove } =
    useCollectionStore();
  const setCollectionId = useHomeStore((s) => s.setCollectionId);

  useBackButton(() => navigate('/collections'));

  // Режим добавления слов
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [query, setQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<DictionaryLookupResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) fetchDetail(Number(id));
  }, [id, fetchDetail]);

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

  const handleAdd = useCallback(
    async (
      meaningIds: number[],
      custom?: { wordText: string; translation: string },
    ) => {
      if (!id) return;
      setIsAdding(true);
      try {
        await addCollectionWords(Number(id), {
          meaningIds: meaningIds.length > 0 ? meaningIds : undefined,
          custom: custom ? [custom] : undefined,
        });
        // Очистить инпут и обновить деталь
        setQuery('');
        setLookupResult(null);
        fetchDetail(Number(id));
        // Фокус обратно на инпут
        inputRef.current?.focus();
      } catch {
        // ошибка
      } finally {
        setIsAdding(false);
      }
    },
    [id, fetchDetail],
  );

  const handleExitAddMode = () => {
    setIsAddingMode(false);
    setQuery('');
    setLookupResult(null);
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await remove(Number(id));
      navigate('/collections');
    } catch {
      // ошибка
    }
  };

  const existingMeaningIds = useMemo(
    () => new Set(currentDetail?.words.map((w) => w.id) ?? []),
    [currentDetail?.words],
  );

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
      {/* Шапка */}
      <div className="flex items-center justify-between">
        <BackButton onClick={() => navigate('/collections')} />
        {isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-10 w-10 items-center justify-center rounded-full transition-colors active:bg-[var(--gray-3)]">
                <HugeiconsIcon icon={MoreVerticalIcon} size={20} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/collections/${collection.id}/edit`)}>
                <HugeiconsIcon icon={Edit02Icon} size={16} />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-[var(--red-11)]"
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
                Удалить коллекцию
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Инфо */}
      <h1 className="mt-4 text-xl font-bold">{collection.title}</h1>
      {collection.description && (
        <p className="mt-1 text-sm text-[var(--gray-11)]">{collection.description}</p>
      )}
      <p className="mt-1 text-xs text-[var(--gray-11)]">
        {collection.totalWords} слов
        {collection.price ? ` · ${collection.price} ₽` : ''}
      </p>

      {/* Список слов */}
      <div className="mt-6 flex flex-1 flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--gray-11)]">{words.length} слов</span>
          <WordViewToggle />
        </div>
        {words.length === 0 && !isAddingMode && (
          <p className="py-8 text-center text-sm text-[var(--gray-11)]">
            Нет слов. Добавьте первое!
          </p>
        )}
        <WordList words={words} />
      </div>

      {/* Нижняя панель */}
      <div className="pointer-events-none sticky bottom-0 -mx-4">
        <div className="h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
        <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pb-4">
          {isOwner ? (
            isAddingMode ? (
              <div className="flex flex-col gap-3">
                {/* Словарная карточка */}
                <DictionaryPreview
                  result={lookupResult}
                  isLoading={isLookingUp}
                  query={query}
                  existingMeaningIds={existingMeaningIds}
                  onAdd={handleAdd}
                />

                {/* Инпут + кнопка выхода */}
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
                      autoFocus
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
                  <Button
                    variant="secondary"
                    size="icon"
                    onClick={handleExitAddMode}
                  >
                    <HugeiconsIcon icon={Tick01Icon} size={20} />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {words.length > 0 && (
                  <Button
                    onClick={() => {
                      setCollectionId(collection.id);
                      navigate('/');
                    }}
                    className="w-full"
                  >
                    Учить эту коллекцию
                  </Button>
                )}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsAddingMode(true);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  className="w-full"
                >
                  <HugeiconsIcon icon={Add01Icon} size={18} />
                  Добавить слова
                </Button>
              </div>
            )
          ) : collection.isInLibrary ? (
            <div className="flex flex-col gap-2">
              {words.length > 0 && (
                <Button
                  onClick={() => {
                    setCollectionId(collection.id);
                    navigate('/');
                  }}
                  className="w-full"
                >
                  Учить эту коллекцию
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => unsubscribe(collection.id)}
                className="w-full"
              >
                Удалить из библиотеки
              </Button>
            </div>
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
