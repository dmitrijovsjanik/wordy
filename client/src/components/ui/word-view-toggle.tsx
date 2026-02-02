import { HugeiconsIcon } from '@hugeicons/react';
import { Menu02Icon, GridIcon } from '@hugeicons/core-free-icons';
import { useWordViewStore } from '@/stores/word-view-store';
import { cn } from '@/lib/utils';

export function WordViewToggle() {
  const viewMode = useWordViewStore((s) => s.viewMode);
  const setViewMode = useWordViewStore((s) => s.setViewMode);

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full bg-[var(--gray-3)] p-0.5">
      <button
        type="button"
        className={cn(
          "flex items-center justify-center size-7 rounded-full transition-colors",
          viewMode === 'list'
            ? "bg-[var(--gray-12)] text-[var(--gray-1)]"
            : "text-[var(--gray-11)]"
        )}
        onClick={() => setViewMode('list')}
      >
        <HugeiconsIcon icon={Menu02Icon} size={14} />
      </button>
      <button
        type="button"
        className={cn(
          "flex items-center justify-center size-7 rounded-full transition-colors",
          viewMode === 'badges'
            ? "bg-[var(--gray-12)] text-[var(--gray-1)]"
            : "text-[var(--gray-11)]"
        )}
        onClick={() => setViewMode('badges')}
      >
        <HugeiconsIcon icon={GridIcon} size={14} />
      </button>
    </div>
  );
}
