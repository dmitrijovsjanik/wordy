import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { Button } from '@/components/ui/button';
import { WordList } from '@/components/ui/word-list';
import { WordViewToggle } from '@/components/ui/word-view-toggle';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import { Progress } from '@/components/ui/progress';
import { ICON_MAP, DEFAULT_ICON } from '@/lib/icon-map';
import type { MarketplaceCollection, CollectionGroup, LibraryCollection } from '@/types/api';

function extractLevel(title: string): string | null {
  const match = title.match(/\b(A1|A2|B1|B2)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function stripLevel(title: string): string {
  return title
    .replace(/\s*\(?(A1|A2|B1|B2)\)?\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLevelStyle(level: string | null): { bg: string; text: string } {
  if (!level) return { bg: 'bg-[var(--gray-3)]', text: 'text-[var(--gray-11)]' };
  switch (level) {
    case 'A1':
      return { bg: 'bg-[var(--cyan-4)]', text: 'text-[var(--cyan-11)]' };
    case 'A2':
      return { bg: 'bg-[var(--teal-4)]', text: 'text-[var(--teal-11)]' };
    case 'B1':
      return { bg: 'bg-[var(--iris-4)]', text: 'text-[var(--iris-11)]' };
    case 'B2':
      return { bg: 'bg-[var(--plum-4)]', text: 'text-[var(--plum-11)]' };
    default:
      return { bg: 'bg-[var(--gray-3)]', text: 'text-[var(--gray-11)]' };
  }
}

type CollectionCardProps = {
  col: MarketplaceCollection | LibraryCollection;
  onClick: () => void;
  variant: 'marketplace' | 'library';
  showLevelInsteadOfIcon?: boolean;
};

function CollectionCard({ col, onClick, variant, showLevelInsteadOfIcon = false }: CollectionCardProps) {
  const IconComponent = col.iconName ? ICON_MAP[col.iconName] ?? DEFAULT_ICON : DEFAULT_ICON;
  const level = showLevelInsteadOfIcon ? extractLevel(col.title) : null;
  const displayTitle = level ? stripLevel(col.title) : col.title;
  const levelStyle = getLevelStyle(level);

  const isMarketplace = variant === 'marketplace';
  const isAdded = isMarketplace && 'isInLibrary' in col && col.isInLibrary;
  const masteredWords = 'masteredWords' in col ? col.masteredWords : 0;
  const pct = col.totalWords > 0 ? Math.round((masteredWords / col.totalWords) * 100) : 0;

  return (
    <div
      className={`flex cursor-pointer items-center gap-3 rounded-xl bg-[var(--gray-2)] p-3 active:bg-[var(--gray-3)] ${isAdded ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${level ? levelStyle.bg : 'bg-[var(--gray-3)]'}`}>
        {level ? (
          <span className={`text-sm font-bold ${levelStyle.text}`}>{level}</span>
        ) : (
          <HugeiconsIcon icon={IconComponent} size={20} className="text-[var(--gray-11)]" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-[var(--gray-12)]">{displayTitle}</span>
        {isMarketplace ? (
          <span className="text-xs text-[var(--gray-11)]">{col.totalWords} слов</span>
        ) : (
          <div className="flex items-center gap-2">
            <Progress value={pct} className="h-1 flex-1" />
            <span className="shrink-0 text-xs tabular-nums text-[var(--gray-11)]">
              {masteredWords}/{col.totalWords}
            </span>
          </div>
        )}
      </div>
      {isMarketplace && (
        <Button
          variant="secondary"
          size="sm"
          className="h-8 shrink-0 px-3 text-xs"
          disabled={isAdded}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          {isAdded ? 'Добавлено' : 'Подробнее'}
        </Button>
      )}
    </div>
  );
}

type Tab = 'library' | 'words' | 'marketplace';

const LEVEL_ORDER = ['A1', 'A2', 'B1', 'B2'] as const;

// Переключатель уровней
function LevelToggle({
  selected,
  onChange,
}: {
  selected: string;
  onChange: (level: string) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={selected}
      onValueChange={(value) => value && onChange(value)}
      variant="outline"
      spacing={2}
    >
      {LEVEL_ORDER.map((level) => (
        <ToggleGroupItem
          key={level}
          value={level}
          className="rounded-full px-4"
        >
          {level}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function MarketplaceGroup({
  group,
  navigate,
}: {
  group: CollectionGroup;
  navigate: (path: string) => void;
}) {
  const isPosGroup = group.key === 'pos';
  const showLevelInsteadOfIcon = group.key === 'pos' || group.key === 'level';
  const [selectedLevel, setSelectedLevel] = useState<string>('A1');

  // Фильтруем по выбранному уровню (только для pos)
  const filteredCollections = useMemo(() => {
    if (!isPosGroup) return group.collections;
    return group.collections.filter((col) => extractLevel(col.title) === selectedLevel);
  }, [group.collections, isPosGroup, selectedLevel]);

  // Сортировка: по уровню (для level группы)
  const sortedCollections = useMemo(() => {
    if (!showLevelInsteadOfIcon || isPosGroup) return filteredCollections;

    const sorted = [...filteredCollections];
    sorted.sort((a, b) => {
      const levelA = extractLevel(a.title);
      const levelB = extractLevel(b.title);
      const indexA = levelA ? LEVEL_ORDER.indexOf(levelA as typeof LEVEL_ORDER[number]) : 99;
      const indexB = levelB ? LEVEL_ORDER.indexOf(levelB as typeof LEVEL_ORDER[number]) : 99;
      return indexA - indexB;
    });

    return sorted;
  }, [filteredCollections, showLevelInsteadOfIcon, isPosGroup]);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold text-[var(--gray-12)]" style={{ fontSize: 24 }}>
        {group.title}
      </h3>

      {isPosGroup && (
        <LevelToggle selected={selectedLevel} onChange={setSelectedLevel} />
      )}

      <div className="flex flex-col gap-1.5">
        {sortedCollections.map((col) => (
          <CollectionCard
            key={col.id}
            col={col}
            variant="marketplace"
            onClick={() => navigate(`/collections/${col.id}`)}
            showLevelInsteadOfIcon={showLevelInsteadOfIcon}
          />
        ))}
      </div>
    </div>
  );
}

export function Collections() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const activeTab: Tab = tabFromUrl && ['library', 'words', 'marketplace'].includes(tabFromUrl)
    ? tabFromUrl
    : 'library';

  const setActiveTab = (tab: Tab) => {
    setSearchParams({ tab }, { replace: true });
  };

  const library = useCollectionStore((s) => s.library);
  const marketplace = useCollectionStore((s) => s.marketplace);
  const allWords = useCollectionStore((s) => s.allWords);
  const isLoadingLibrary = useCollectionStore((s) => s.isLoadingLibrary);
  const isLoadingMarketplace = useCollectionStore((s) => s.isLoadingMarketplace);
  const isLoadingAllWords = useCollectionStore((s) => s.isLoadingAllWords);
  const fetchLibrary = useCollectionStore((s) => s.fetchLibrary);
  const fetchMarketplace = useCollectionStore((s) => s.fetchMarketplace);
  const fetchAllWords = useCollectionStore((s) => s.fetchAllWords);

  useEffect(() => {
    fetchLibrary();
    fetchMarketplace();
    fetchAllWords();
  }, [fetchLibrary, fetchMarketplace, fetchAllWords]);

  return (
    <div className="flex min-h-full flex-col px-4">
      {/* Sticky tabs */}
      <div className="pointer-events-none sticky top-0 z-10 -mx-4">
        <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pt-4">
          <TabsList>
            <TabsTrigger active={activeTab === 'library'} onClick={() => setActiveTab('library')}>
              Библиотека
            </TabsTrigger>
            <TabsTrigger active={activeTab === 'words'} onClick={() => setActiveTab('words')}>
              Все слова
            </TabsTrigger>
            <TabsTrigger active={activeTab === 'marketplace'} onClick={() => setActiveTab('marketplace')}>
              Каталог
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="h-8 bg-gradient-to-b from-[var(--gray-1)] to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 pb-4">
        {activeTab === 'library' && isLoadingLibrary && (
          <>
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </>
        )}

        {activeTab === 'library' && !isLoadingLibrary && (
          <>
            {library.length === 0 && (
              <p className="mt-4 text-center text-sm text-[var(--gray-11)]">
                Библиотека пуста. Добавьте коллекцию из каталога!
              </p>
            )}

            {library.map((col) => (
              <CollectionCard
                key={col.id}
                col={col}
                variant="library"
                onClick={() => navigate(`/collections/${col.id}`)}
              />
            ))}
          </>
        )}

        {activeTab === 'words' && isLoadingAllWords && (
          <>
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </>
        )}

        {activeTab === 'words' && !isLoadingAllWords && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--gray-11)]">{allWords.length} слов</span>
              <WordViewToggle />
            </div>

            {allWords.length === 0 && (
              <p className="mt-4 text-center text-sm text-[var(--gray-11)]">
                Нет слов. Добавьте коллекции в библиотеку!
              </p>
            )}

            <WordList words={allWords} />
          </>
        )}

        {activeTab === 'marketplace' && isLoadingMarketplace && (
          <>
            <Skeleton className="h-8 w-32 rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </>
        )}

        {activeTab === 'marketplace' && !isLoadingMarketplace && (
          <>
            {marketplace.length === 0 && (
              <p className="mt-4 text-center text-sm text-[var(--gray-11)]">
                Каталог пуст
              </p>
            )}

            {marketplace.map((group) => (
              <MarketplaceGroup key={group.key} group={group} navigate={navigate} />
            ))}
          </>
        )}
      </div>

      {/* Create button */}
      {activeTab === 'library' && !isLoadingLibrary && (
        <div className="pointer-events-none sticky bottom-0 -mx-4">
          <div className="h-8 bg-gradient-to-t from-[var(--gray-1)] to-transparent" />
          <div className="pointer-events-auto bg-[var(--gray-1)] px-4 pb-4">
            <Button
              className="w-full gap-2"
              onClick={() => navigate('/collections/create')}
            >
              <HugeiconsIcon strokeWidth={2} icon={Add01Icon} size={20} />
              Создать коллекцию
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
