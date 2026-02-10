import { useEffect, useState } from 'react';
import { getCefrProgress } from '@/lib/api';
import type { CefrProgressLevel } from '@/types/api';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ─── CEFR Level Colors ──────────────────────────────────────────────────────

const CEFR_COLORS: Record<string, string> = {
  a1: 'var(--green-9)',
  a2: 'var(--blue-9)',
  b1: 'var(--orange-9)',
  b2: 'var(--purple-9)',
  c1: 'var(--red-9)',
};

const CEFR_LABELS: Record<string, string> = {
  a1: 'A1',
  a2: 'A2',
  b1: 'B1',
  b2: 'B2',
  c1: 'C1',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CefrProgress({ className }: { className?: string }) {
  const [levels, setLevels] = useState<CefrProgressLevel[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getCefrProgress()
      .then((data) => setLevels(data.levels))
      .catch(() => setError(true));
  }, []);

  if (error) return null;

  if (!levels) {
    return (
      <div className={cn("rounded-2xl bg-[var(--gray-2)] p-4", className)}>
        <Skeleton className="mb-3 h-4 w-32 rounded" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-8 shrink-0 rounded" />
              <Skeleton className="h-2 flex-1 rounded-full" />
              <Skeleton className="h-4 w-14 shrink-0 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl bg-[var(--gray-2)] p-4", className)}>
      <h3 className="mb-3 text-sm font-semibold text-[var(--gray-12)]">
        Прогресс CEFR
      </h3>

      <div className="flex flex-col gap-3">
        {levels.map((lvl) => {
          const color = CEFR_COLORS[lvl.level] ?? 'var(--gray-9)';
          const label = CEFR_LABELS[lvl.level] ?? lvl.level.toUpperCase();

          return (
            <div key={lvl.level} className="flex items-center gap-3">
              <span
                className="w-8 shrink-0 text-xs font-bold"
                style={{ color }}
              >
                {label}
              </span>

              <div className="relative flex-1">
                <Progress
                  value={lvl.percent}
                  className="h-2"
                  style={{
                    // Переопределяем цвет индикатора через CSS-переменную
                    '--progress-indicator-color': color,
                  } as React.CSSProperties}
                />
              </div>

              <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-[var(--gray-11)]">
                {lvl.learnedWords}/{lvl.totalWords}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
