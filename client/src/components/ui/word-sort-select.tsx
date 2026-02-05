import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useWordViewStore, type WordSortMode } from '@/stores/word-view-store';

const SORT_OPTIONS: { value: WordSortMode; label: string }[] = [
  { value: 'popularity', label: 'По популярности' },
  { value: 'alphabetical', label: 'По алфавиту' },
  { value: 'progress', label: 'По прогрессу' },
];

export function WordSortSelect() {
  const sortMode = useWordViewStore((s) => s.sortMode);
  const setSortMode = useWordViewStore((s) => s.setSortMode);

  const currentLabel = SORT_OPTIONS.find((o) => o.value === sortMode)?.label ?? 'По популярности';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--gray-3)] px-2.5 text-sm text-[var(--gray-11)] active:bg-[var(--gray-4)]"
        >
          {currentLabel}
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SORT_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setSortMode(option.value)}
            className={sortMode === option.value ? 'bg-[var(--gray-4)]' : ''}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
