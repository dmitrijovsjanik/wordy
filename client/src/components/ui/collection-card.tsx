import { HugeiconsIcon } from '@hugeicons/react';
import { Book02Icon, PlayIcon } from '@hugeicons/core-free-icons';
import { ICON_MAP, DEFAULT_ICON } from '@/lib/icon-map';
import { cn } from '@/lib/utils';
import type { CefrLevel, LibraryCollection, MarketplaceCollection } from '@/types/api';

const CEFR_LABELS: Record<CefrLevel, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
};

export type CollectionCardProps =
  | {
      mode: 'catalog';
      collection: MarketplaceCollection;
      onClick: () => void;
    }
  | {
      mode: 'library';
      collection: LibraryCollection;
      isActive?: boolean;
      onClick: () => void;
    };

export function CollectionCard(props: CollectionCardProps) {
  const { mode, collection, onClick } = props;
  const isActive = mode === 'library' ? props.isActive ?? false : false;
  const isInLibrary = mode === 'catalog' ? collection.isInLibrary : true;

  const Icon = collection.iconName ? ICON_MAP[collection.iconName] ?? DEFAULT_ICON : Book02Icon;
  const cefr = collection.cefrLevel;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex shrink-0 flex-col items-start gap-3 rounded-[32px] p-6 text-left transition-colors',
        'bg-[rgba(188,214,254,0.08)] active:bg-[rgba(188,214,254,0.12)]',
        isActive && 'ring-2 ring-[var(--brand-9)]',
      )}
    >
      <div className="flex items-center gap-2 pr-12">
        <HugeiconsIcon icon={Icon} size={20} className="shrink-0 text-[var(--gray-11)]" strokeWidth={2} />
        <span className="text-xl font-semibold leading-7 text-white">{collection.title}</span>
      </div>
      {collection.description && (
        <span className="text-base leading-[22px] text-[var(--gray-11)]">{collection.description}</span>
      )}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--gray-11)]">
        {cefr && (
          <span className="rounded-full bg-[var(--brand-3)] px-2 py-0.5 text-[var(--brand-11)]">
            {CEFR_LABELS[cefr]}
          </span>
        )}
        <span>
          {collection.totalWords} слов
          {mode === 'library' && collection.masteredWords > 0
            ? `, ${collection.masteredWords} выучено`
            : ''}
        </span>
        {mode === 'catalog' && isInLibrary && (
          <span className="rounded-full bg-[var(--green-3)] px-2 py-0.5 text-[var(--green-11)]">
            В библиотеке
          </span>
        )}
      </div>
      {isActive && (
        <div
          aria-label="Активная коллекция"
          className="absolute right-6 top-6 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--brand-9)]"
        >
          <HugeiconsIcon icon={PlayIcon} size={16} className="text-white" strokeWidth={2} />
        </div>
      )}
    </button>
  );
}
