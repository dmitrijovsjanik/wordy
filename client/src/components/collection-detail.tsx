import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { useBackButton } from '@/hooks/use-back-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WordList } from '@/components/ui/word-list';
import { countUniqueWords } from '@/lib/word-utils';
import { WordViewToggle } from '@/components/ui/word-view-toggle';
import { WordSortSelect } from '@/components/ui/word-sort-select';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { DictionaryPreview, getMeaningIds, isAlreadyAdded } from '@/components/ui/dictionary-preview';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Delete02Icon,
  Edit02Icon,
  Search01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';
import { dictionaryLookup, addCollectionWords, removeCollectionWord } from '@/lib/api';
import { useUnifiedGameStore } from '@/stores/unified-game-store';
import { PremiumDrawer } from '@/components/ui/premium-drawer';
import type { DictionaryLookupResult } from '@/types/api';

const MAX_FREE_WORDS = 50;

export function CollectionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const currentDetail = useCollectionStore((s) => s.currentDetail);
  const isLoadingDetail = useCollectionStore((s) => s.isLoadingDetail);
  const fetchDetail = useCollectionStore((s) => s.fetchDetail);
  const subscribe = useCollectionStore((s) => s.subscribe);
  const unsubscribe = useCollectionStore((s) => s.unsubscribe);
  const update = useCollectionStore((s) => s.update);
  const remove = useCollectionStore((s) => s.remove);
  const setCollectionId = useUnifiedGameStore((s) => s.setCollectionId);

  useBackButton(() => navigate('/collections'));

  // Режим добавления слов
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [query, setQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<DictionaryLookupResult | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [manualTranslation, setManualTranslation] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Premium paywall
  const [showPremiumDrawer, setShowPremiumDrawer] = useState(false);

  // Модалка редактирования
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

      // Проверяем лимит слов для user-коллекций (бесплатный план)
      const currentWordCount = currentDetail?.words.length ?? 0;
      if (currentDetail?.collection.type === 'user' && currentWordCount >= MAX_FREE_WORDS) {
        setShowPremiumDrawer(true);
        return;
      }

      setIsAdding(true);
      try {
        await addCollectionWords(Number(id), {
          meaningIds: meaningIds.length > 0 ? meaningIds : undefined,
          custom: custom ? [custom] : undefined,
        });
        setQuery('');
        setLookupResult(null);
        fetchDetail(Number(id));
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

  const removeWordsLocally = useCollectionStore((s) => s.removeWordsLocally);

  const handleDeleteWords = useCallback(
    async (wordIds: number[]) => {
      if (!id) return;
      removeWordsLocally(wordIds);
      await Promise.all(wordIds.map((wId) => removeCollectionWord(Number(id), wId)));
    },
    [id, removeWordsLocally],
  );

  const handleOpenEdit = () => {
    if (!currentDetail) return;
    setEditTitle(currentDetail.collection.title);
    setEditDescription(currentDetail.collection.description ?? '');
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!id || !editTitle.trim()) return;
    setIsSavingEdit(true);
    try {
      await update(Number(id), {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
      });
      setIsEditOpen(false);
    } catch {
      // ошибка
    } finally {
      setIsSavingEdit(false);
    }
  };

  const existingMeaningIds = useMemo(
    () => new Set(currentDetail?.words.map((w) => w.id) ?? []),
    [currentDetail?.words],
  );

  if (isLoadingDetail || !currentDetail) {
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
        {isOwner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpenEdit}>
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
        ) : collection.isInLibrary ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} size={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  await unsubscribe(collection.id);
                  navigate('/collections');
                }}
                className="text-[var(--red-11)]"
              >
                <HugeiconsIcon icon={Delete02Icon} size={16} />
                Удалить из библиотеки
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {/* Инфо */}
      <h1 className="mt-4 text-xl font-bold">{collection.title}</h1>
      {collection.description && (
        <p className="mt-1 text-sm text-[var(--gray-11)]">{collection.description}</p>
      )}
      {collection.price && (
        <p className="mt-1 text-xs text-[var(--gray-11)]">
          {collection.price} ₽
        </p>
      )}

      {/* Список слов */}
      <div className="mt-6 flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--gray-11)]">
            {collection.type === 'user'
              ? `${countUniqueWords(words)}/${MAX_FREE_WORDS} слов`
              : `${countUniqueWords(words)} слов`}
          </span>
          <div className="flex items-center gap-2">
            <WordSortSelect />
            <WordViewToggle />
          </div>
        </div>
        {words.length === 0 && !isAddingMode && (
          <p className="py-8 text-center text-sm text-[var(--gray-11)]">
            Нет слов. Добавьте первое!
          </p>
        )}
        <WordList
          words={words}
          onDeleteWords={isOwner ? handleDeleteWords : undefined}
        />
      </div>

      {/* Оверлей при показе карточки словаря */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 ${
          isAddingMode && (query.trim() || isLookingUp)
            ? 'opacity-100'
            : 'pointer-events-none opacity-0'
        }`}
        onClick={() => {
          setQuery('');
          setLookupResult(null);
          setManualTranslation('');
        }}
      />

      {/* Нижняя панель */}
      <div className={`pointer-events-none sticky bottom-0 -mx-4 ${isAddingMode && (query.trim() || isLookingUp) ? 'z-50' : ''}`}>
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
                  manualTranslation={manualTranslation}
                  onManualTranslationChange={setManualTranslation}
                />

                {/* Инпут + кнопка действия */}
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
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setManualTranslation('');
                      }}
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
                          setManualTranslation('');
                          inputRef.current?.focus();
                        }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--gray-11)] active:text-[var(--gray-12)]"
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={18} />
                      </button>
                    )}
                  </div>
                  {/* Кнопка: синяя с + если можно добавить, серая с × если пусто */}
                  {(() => {
                    const meaningIds = getMeaningIds(lookupResult);
                    const canAddFromApi = meaningIds.length > 0 && !isAlreadyAdded(lookupResult, existingMeaningIds);
                    const canAddManual = !lookupResult?.meanings.length && query.trim() && manualTranslation.trim();
                    const canAdd = canAddFromApi || canAddManual;

                    if (canAdd) {
                      return (
                        <Button
                          size="icon"
                          disabled={isAdding}
                          onClick={() => {
                            if (canAddManual) {
                              handleAdd([], { wordText: query.trim(), translation: manualTranslation.trim() });
                            } else {
                              handleAdd(meaningIds);
                            }
                          }}
                        >
                          <HugeiconsIcon icon={Add01Icon} size={20} />
                        </Button>
                      );
                    }

                    return (
                      <Button
                        variant="secondary"
                        size="icon"
                        onClick={handleExitAddMode}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={20} />
                      </Button>
                    );
                  })()}
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
                    if (collection.type === 'user' && words.length >= MAX_FREE_WORDS) {
                      setShowPremiumDrawer(true);
                    } else {
                      setIsAddingMode(true);
                      setTimeout(() => inputRef.current?.focus(), 100);
                    }
                  }}
                  className="w-full"
                >
                  <HugeiconsIcon icon={Add01Icon} size={18} />
                  Добавить слова
                </Button>
              </div>
            )
          ) : collection.isInLibrary ? (
            words.length > 0 && (
              <Button
                onClick={() => {
                  setCollectionId(collection.id);
                  navigate('/');
                }}
                className="w-full"
              >
                Учить эту коллекцию
              </Button>
            )
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

      {/* Модалка редактирования */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать коллекцию</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              placeholder="Название"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <Input
              placeholder="Описание (необязательно)"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveEdit}
              disabled={!editTitle.trim() || isSavingEdit}
              className="w-full"
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PremiumDrawer
        open={showPremiumDrawer}
        onOpenChange={setShowPremiumDrawer}
        limitType="words"
      />
    </div>
  );
}
