import { cn } from '@/lib/utils';

const TOTAL_STAGES = 6;

type SrsIndicatorProps = {
  stage: number;
  className?: string;
};

export function SrsIndicator({ stage, className }: SrsIndicatorProps) {
  return (
    <div className={cn('flex gap-0.5', className)}>
      {Array.from({ length: TOTAL_STAGES }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i < stage
              ? stage >= TOTAL_STAGES
                ? 'bg-[var(--green-9)]'
                : 'bg-[var(--brand-9)]'
              : 'bg-[var(--gray-6)]',
          )}
        />
      ))}
    </div>
  );
}
