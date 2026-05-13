import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCollectionStore } from '@/stores/collection-store';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { PremiumDrawer } from '@/components/ui/premium-drawer';
import { BackButton } from '@/components/ui/back-button';
import { useBackButton } from '@/hooks/use-back-button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Book02Icon } from '@hugeicons/core-free-icons';
import { Progress } from '@/components/ui/progress';
import { ICON_MAP, DEFAULT_ICON } from '@/lib/icon-map';
import { PILOT_FEATURES } from '@/lib/pilot-config';
import type { MarketplaceCollection, CollectionGroup, LibraryCollection, CefrLevel } from '@/types/api';

const MAX_FREE_COLLECTIONS = 1;

const CEFR_LABELS: Record<CefrLevel, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
};

function getLevelStyle(level: CefrLevel | null): { bg: string; text: string } {
  if (!level) return { bg: 'bg-[var(--gray-3)]', text: 'text-[var(--gray-11)]' };
  switch (level) {
    case 'a1':
      return { bg: 'bg-[var(--cyan-4)]', text: 'text-[var(--cyan-11)]' };
    case 'a2':
      return { bg: 'bg-[var(--teal-4)]', text: 'text-[var(--teal-11)]' };
    case 'b1':
      return { bg: 'bg-[var(--iris-4)]', text: 'text-[var(--iris-11)]' };
    case 'b2':
      return { bg: 'bg-[var(--plum-4)]', text: 'text-[var(--plum-11)]' };
    case 'c1':
      return { bg: 'bg-[var(--violet-4)]', text: 'text-[var(--violet-11)]' };
    default:
      return { bg: 'bg-[var(--gray-3)]', text: 'text-[var(--gray-11)]' };
  }
}

type CollectionCardProps = {
  col: MarketplaceCollection | LibraryCollection;
  onClick: () => void;
  variant: 'marketplace' | 'library';
};

function CollectionCard({ col, onClick, variant }: CollectionCardProps) {
  const IconComponent = col.iconName ? ICON_MAP[col.iconName] ?? DEFAULT_ICON : DEFAULT_ICON;
  const level = col.cefrLevel;
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
          <span className={`text-sm font-bold ${levelStyle.text}`}>{CEFR_LABELS[level]}</span>
        ) : (
          <HugeiconsIcon icon={IconComponent} size={20} className="text-[var(--gray-11)]" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-[var(--gray-12)]">{col.title}</span>
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

type Tab = 'library' | 'marketplace';

const LEVEL_ORDER: CefrLevel[] = ['a1', 'a2', 'b1', 'b2'];

// Переключатель уровней
function LevelToggle({
  selected,
  onChange,
}: {
  selected: CefrLevel;
  onChange: (level: CefrLevel) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      value={selected}
      onValueChange={(value) => value && onChange(value as CefrLevel)}
      variant="outline"
      spacing={2}
    >
      {LEVEL_ORDER.map((level) => (
        <ToggleGroupItem
          key={level}
          value={level}
          className="rounded-full px-4"
        >
          {CEFR_LABELS[level]}
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
  const isLevelGroup = group.key === 'level';
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel>('a1');

  // Фильтруем по выбранному уровню (только для pos)
  const filteredCollections = useMemo(() => {
    if (!isPosGroup) return group.collections;
    return group.collections.filter((col) => col.cefrLevel === selectedLevel);
  }, [group.collections, isPosGroup, selectedLevel]);

  // Сортировка: по уровню (для level группы)
  const sortedCollections = useMemo(() => {
    if (!isLevelGroup) return filteredCollections;

    const sorted = [...filteredCollections];
    sorted.sort((a, b) => {
      const indexA = a.cefrLevel ? LEVEL_ORDER.indexOf(a.cefrLevel) : 99;
      const indexB = b.cefrLevel ? LEVEL_ORDER.indexOf(b.cefrLevel) : 99;
      return indexA - indexB;
    });

    return sorted;
  }, [filteredCollections, isLevelGroup]);

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
  const activeTab: Tab = tabFromUrl && ['library', 'marketplace'].includes(tabFromUrl)
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
  const fetchLibrary = useCollectionStore((s) => s.fetchLibrary);
  const fetchMarketplace = useCollectionStore((s) => s.fetchMarketplace);
  const fetchAllWords = useCollectionStore((s) => s.fetchAllWords);

  const [showPremiumDrawer, setShowPremiumDrawer] = useState(false);
  const customCollectionsCount = library.filter((c) => c.type === 'user').length;

  const goBack = useCallback(() => navigate(-1), [navigate]);
  useBackButton(goBack);

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
          <BackButton onClick={goBack} variant="ghost" />
          <TabsList>
            <TabsTrigger active={activeTab === 'library'} onClick={() => setActiveTab('library')}>
              Библиотека
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
            {/* Карточка "Все слова" */}
            <div
              className="flex cursor-pointer items-center gap-3 rounded-xl bg-[var(--gray-2)] p-3 active:bg-[var(--gray-3)]"
              onClick={() => navigate('/words')}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-4)]">
                <HugeiconsIcon icon={Book02Icon} size={20} className="text-[var(--brand-11)]" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-[var(--gray-12)]">
                  Все слова
                </span>
                <span className="text-xs text-[var(--gray-11)]">
                  {allWords.length} слов
                </span>
              </div>
            </div>

            {/* Пользовательские коллекции — выше каталожных */}
            {library.filter((c) => c.type !== 'system').map((col) => (
              <CollectionCard
                key={col.id}
                col={col}
                variant="library"
                onClick={() => navigate(`/collections/${col.id}`)}
              />
            ))}

            {/* Баннер: нет коллекций из каталога */}
            {!library.some((c) => c.type === 'system') && (
              <div className="flex flex-col items-center gap-3 rounded-xl p-5">
                <p className="text-center text-sm text-[var(--gray-12)]">
                  Добавьте коллекцию из каталога для более эффективного обучения
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveTab('marketplace')}
                >
                  Открыть каталог
                </Button>
              </div>
            )}

            {/* Каталожные коллекции */}
            {library.filter((c) => c.type === 'system').map((col) => (
              <CollectionCard
                key={col.id}
                col={col}
                variant="library"
                onClick={() => navigate(`/collections/${col.id}`)}
              />
            ))}
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
              onClick={() => {
                if (PILOT_FEATURES.payments && customCollectionsCount >= MAX_FREE_COLLECTIONS) {
                  setShowPremiumDrawer(true);
                } else {
                  navigate('/collections/create');
                }
              }}
            >
              <HugeiconsIcon strokeWidth={2} icon={Add01Icon} size={20} />
              Создать коллекцию
            </Button>
          </div>
        </div>
      )}

      <PremiumDrawer
        open={showPremiumDrawer}
        onOpenChange={setShowPremiumDrawer}
        limitType="collections"
      />
    </div>
  );
}
