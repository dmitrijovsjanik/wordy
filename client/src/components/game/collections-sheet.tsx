import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  Add01Icon,
  Cancel01Icon,
  PlayIcon,
} from '@hugeicons/core-free-icons';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { WordList } from '@/components/ui/word-list';
import { CollectionCard } from '@/components/ui/collection-card';
import { useCollectionStore } from '@/stores/collection-store';
import { useLearningStore } from '@/stores/learning-store';
import { cn } from '@/lib/utils';

type Tab = 'mine' | 'catalog';
type View = 'list' | 'detail' | 'create';

type CollectionsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Bottom-sheet выбора коллекции для экранов изучения (Figma 5152:7577 / 5152:7648).
 *
 * Двухэтапный snap: 60vh при первом открытии, 95vh при перетаскивании вверх.
 *
 * View 'list' — два таба «Мои» / «Каталог», FAB «+ Создать» внизу в табе «Мои».
 * View 'detail' — карточка коллекции + список её слов + кнопка запуска / возврата.
 * View 'create' — заглушка под пользовательскую коллекцию.
 */
export function CollectionsSheet({ open, onOpenChange }: CollectionsSheetProps) {
  const [view, setView] = useState<View>('list');
  const [tab, setTab] = useState<Tab>('mine');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const fetchLibrary = useCollectionStore((s) => s.fetchLibrary);

  // Подгружаем библиотеку при открытии sheet. Кэш TTL соблюдается внутри store.
  useEffect(() => {
    if (open) fetchLibrary();
  }, [open, fetchLibrary]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setView('list');
      setTab('mine');
      setSelectedId(null);
    }
    onOpenChange(next);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="!h-[90vh] !max-h-[90vh] !rounded-t-[48px] [&>button[data-slot=drawer-close]]:hidden">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Выбор коллекции</DrawerTitle>
          <DrawerDescription>Список ваших коллекций для изучения</DrawerDescription>
        </DrawerHeader>
        {view === 'list' && (
          <ListView
            tab={tab}
            onTabChange={setTab}
            onSelect={(id) => {
              setSelectedId(id);
              setView('detail');
            }}
            onCreate={() => setView('create')}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {view === 'detail' && selectedId !== null && (
          <DetailView
            collectionId={selectedId}
            onBack={() => setView('list')}
            onClose={() => handleOpenChange(false)}
          />
        )}
        {view === 'create' && (
          <CreateView
            onBack={() => setView('list')}
            onClose={() => handleOpenChange(false)}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

// ─── Header (общий для всех view) ─────────────────────────────────────────────

type SheetHeaderProps = {
  /** Левый слот. Обычно либо таб-переключатель (list), либо кнопка «Назад» (detail/create). */
  leftSlot?: React.ReactNode;
  /** Центральный заголовок (только в detail/create). В list пустой. */
  title?: string;
  /** Правый слот. По умолчанию — крестик закрытия sheet. */
  rightSlot?: React.ReactNode;
};

function SheetHeader({ leftSlot, title, rightSlot }: SheetHeaderProps) {
  return (
    <header className="flex shrink-0 items-center gap-2 px-8 py-4">
      <div className="flex shrink-0 items-center">
        {leftSlot ?? <div className="size-11" />}
      </div>
      <div className="flex flex-1 items-center justify-center">
        {title && (
          <span className="truncate text-sm font-medium leading-5 text-[var(--gray-11)]">{title}</span>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        {rightSlot ?? <div className="size-11" />}
      </div>
    </header>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Назад"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--gray-3)] active:bg-[var(--gray-4)]"
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} size={18} className="text-[var(--gray-11)]" strokeWidth={2} />
    </button>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Закрыть"
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--gray-3)] active:bg-[var(--gray-4)]"
    >
      <HugeiconsIcon icon={Cancel01Icon} size={18} className="text-[var(--gray-11)]" strokeWidth={2} />
    </button>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

function Tabs({ tab, onTabChange }: { tab: Tab; onTabChange: (t: Tab) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-[var(--gray-3)] p-1">
      {(['mine', 'catalog'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onTabChange(t)}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            tab === t
              ? 'bg-[var(--brand-9)] text-white'
              : 'text-[var(--gray-11)] active:bg-[var(--gray-4)]',
          )}
        >
          {t === 'mine' ? 'Мои' : 'Каталог'}
        </button>
      ))}
    </div>
  );
}

// ─── View: list (мои коллекции + каталог по табам) ────────────────────────────

type ListViewProps = {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onSelect: (id: number) => void;
  onCreate: () => void;
  onClose: () => void;
};

function ListView({ tab, onTabChange, onSelect, onCreate, onClose }: ListViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader
        leftSlot={<Tabs tab={tab} onTabChange={onTabChange} />}
        rightSlot={<CloseButton onClick={onClose} />}
      />
      <div className="relative flex min-h-0 flex-1 flex-col">
        {tab === 'mine' ? (
          <MineList onSelect={onSelect} onCreate={onCreate} />
        ) : (
          <CatalogList onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}

// ─── Mine tab ─────────────────────────────────────────────────────────────────

function MineList({ onSelect, onCreate }: { onSelect: (id: number) => void; onCreate: () => void }) {
  const library = useCollectionStore((s) => s.library);
  const isLoading = useCollectionStore((s) => s.isLoadingLibrary);
  const currentLearningCollectionId = useLearningStore((s) => s.collectionId);

  // Подсвечиваем коллекцию, по которой реально идёт учебная сессия.
  // library.isActive — server-side флаг (может быть несколько true одновременно),
  // источник правды для UI — learning-store.collectionId.
  const activeId = currentLearningCollectionId ?? null;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-24 pt-4">
        {isLoading && library.length === 0 && (
          <div className="text-center text-sm text-[var(--gray-11)]">Загрузка…</div>
        )}
        {library.length === 0 && !isLoading && (
          <div className="mt-12 flex flex-col items-center gap-3 px-8 text-center">
            <p className="text-sm text-[var(--gray-11)]">
              У вас пока нет коллекций. Откройте каталог или создайте свою.
            </p>
          </div>
        )}
        {library.map((c) => (
          <CollectionCard
            key={c.id}
            mode="library"
            collection={c}
            isActive={c.id === activeId}
            onClick={() => onSelect(c.id)}
          />
        ))}
      </div>
      {/* Floating action button — создание пользовательской коллекции. */}
      <button
        type="button"
        onClick={onCreate}
        className={cn(
          'absolute bottom-4 right-4 flex items-center gap-2 rounded-full px-5 py-3',
          'bg-[var(--brand-9)] text-sm font-medium text-white shadow-lg',
          'active:bg-[var(--brand-10)]',
        )}
      >
        <HugeiconsIcon icon={Add01Icon} size={18} className="text-white" strokeWidth={2} />
        Создать
      </button>
    </>
  );
}

// ─── Catalog tab ──────────────────────────────────────────────────────────────

function CatalogList({ onSelect }: { onSelect: (id: number) => void }) {
  const marketplace = useCollectionStore((s) => s.marketplace);
  const isLoading = useCollectionStore((s) => s.isLoadingMarketplace);
  const fetchMarketplace = useCollectionStore((s) => s.fetchMarketplace);

  useEffect(() => {
    fetchMarketplace();
  }, [fetchMarketplace]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4">
      {isLoading && marketplace.length === 0 && (
        <div className="text-center text-sm text-[var(--gray-11)]">Загрузка каталога…</div>
      )}
      {marketplace.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <h3 className="px-2 text-sm font-semibold uppercase tracking-wide text-[var(--gray-11)]">
            {group.title}
          </h3>
          <div className="flex flex-col gap-2">
            {group.collections.map((c) => (
              <CollectionCard
                key={c.id}
                mode="catalog"
                collection={c}
                onClick={() => onSelect(c.id)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── View: detail ────────────────────────────────────────────────────────────

type DetailViewProps = {
  collectionId: number;
  onBack: () => void;
  /** Закрывает sheet целиком — используется для крестика и после успешного запуска. */
  onClose: () => void;
};

function DetailView({ collectionId, onBack, onClose }: DetailViewProps) {
  const library = useCollectionStore((s) => s.library);
  const toggle = useCollectionStore((s) => s.toggle);
  const subscribe = useCollectionStore((s) => s.subscribe);
  const fetchDetail = useCollectionStore((s) => s.fetchDetail);
  const currentDetail = useCollectionStore((s) => s.currentDetail);
  const isLoadingDetail = useCollectionStore((s) => s.isLoadingDetail);
  const currentLearningCollectionId = useLearningStore((s) => s.collectionId);
  const setLearningCollectionId = useLearningStore((s) => s.setCollectionId);

  const libraryEntry = library.find((c) => c.id === collectionId);
  const isInLibrary = !!libraryEntry;
  // «Активная» с точки зрения UI — это коллекция текущей учебной сессии,
  // а не несколько `isActive=true` записей в library. См. LearningHeader.
  const isActive = currentLearningCollectionId === collectionId;
  // Из detail берём слова (в library их нет). Заголовок/описание/totalWords —
  // приоритет detail.collection, fallback на libraryEntry.
  const detailCollection = currentDetail?.collection.id === collectionId
    ? currentDetail.collection
    : null;
  const words = currentDetail?.collection.id === collectionId ? currentDetail.words : [];

  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    fetchDetail(collectionId);
  }, [collectionId, fetchDetail]);

  const title = detailCollection?.title ?? libraryEntry?.title ?? 'Коллекция';
  const description = detailCollection?.description ?? libraryEntry?.description ?? null;
  const totalWords = detailCollection?.totalWords ?? libraryEntry?.totalWords ?? 0;

  const handleLaunch = async () => {
    if (isActive) {
      onClose();
      return;
    }
    setIsBusy(true);
    try {
      if (!isInLibrary) {
        // Не в библиотеке — подписываемся (subscribe сам делает isActive=true
        // и инвалидирует library).
        await subscribe(collectionId);
      } else {
        // Деактивируем других, активируем текущую — синхронизируем
        // server-side флаг isActive с тем, что показывает UI.
        const otherActive = library.filter((c) => c.isActive && c.id !== collectionId);
        for (const c of otherActive) {
          await toggle(c.id, false);
        }
        await toggle(collectionId, true);
      }
      // Переключаем учебную сессию на новую коллекцию: сброс question и
      // history (внутри setCollectionId), потом vocabulary-screen увидит
      // changeCollection и сам подтянет следующий вопрос.
      setLearningCollectionId(collectionId);
      onClose();
    } finally {
      setIsBusy(false);
    }
  };

  const launchLabel = isActive
    ? 'Продолжить изучение'
    : isInLibrary
      ? 'Запустить эту коллекцию'
      : 'Добавить и запустить';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader
        leftSlot={<BackButton onClick={onBack} />}
        title={title}
        rightSlot={<CloseButton onClick={onClose} />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div className="rounded-[32px] bg-[rgba(188,214,254,0.08)] p-6">
          {description && (
            <span className="text-base leading-[22px] text-[var(--gray-11)]">{description}</span>
          )}
          <div className="mt-4 flex gap-6 text-sm">
            <div className="flex flex-col">
              <span className="text-[var(--gray-11)]">Всего слов</span>
              <span className="font-semibold text-white">{totalWords}</span>
            </div>
            {isInLibrary && (
              <div className="flex flex-col">
                <span className="text-[var(--gray-11)]">Выучено</span>
                <span className="font-semibold text-white">{libraryEntry!.masteredWords}</span>
              </div>
            )}
          </div>
        </div>

        {isLoadingDetail && words.length === 0 ? (
          <div className="rounded-[32px] bg-[rgba(188,214,254,0.08)] p-4 text-center text-sm text-[var(--gray-11)]">
            Загрузка слов…
          </div>
        ) : words.length > 0 ? (
          <WordList words={words} />
        ) : (
          <div className="rounded-[32px] bg-[rgba(188,214,254,0.08)] p-4 text-center text-sm text-[var(--gray-11)]">
            В этой коллекции пока нет слов.
          </div>
        )}
      </div>
      <div className="shrink-0 p-4">
        <button
          type="button"
          onClick={handleLaunch}
          disabled={isBusy}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-full px-4 py-4 text-sm font-medium text-white transition-colors',
            'bg-[var(--brand-9)] active:bg-[var(--brand-10)] disabled:opacity-40',
          )}
        >
          <HugeiconsIcon icon={PlayIcon} size={16} className="text-white" strokeWidth={2} />
          {launchLabel}
        </button>
      </div>
    </div>
  );
}

// ─── View: create (TODO — пользовательская коллекция) ────────────────────────

function CreateView({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SheetHeader
        leftSlot={<BackButton onClick={onBack} />}
        title="Создать коллекцию"
        rightSlot={<CloseButton onClick={onClose} />}
      />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
        {/* TODO: форма создания коллекции (title, description, level).
            Существующий CollectionCreate.tsx можно использовать как референс. */}
        <p className="text-sm text-[var(--gray-11)]">
          Создание пользовательских коллекций пока недоступно.
        </p>
      </div>
    </div>
  );
}
