import { cn } from '@/lib/utils';

const TOTAL_STAGES = 6;
const MAX_DEBT = 2; // Максимальный отображаемый долг

type SrsIndicatorProps = {
  stage: number | null; // null = не встречалось
  className?: string;
};

export function SrsIndicator({ stage, className }: SrsIndicatorProps) {
  // null = не встречалось — не показываем индикатор вообще
  if (stage === null) {
    return null;
  }

  // Отрицательный stage = долг (красные кружки)
  const debt = stage < 0 ? Math.min(Math.abs(stage), MAX_DEBT) : 0;
  const progress = Math.max(0, stage);

  return (
    <div className={cn('flex gap-0.5', className)}>
      {/* Красные кружки долга (слева) */}
      {Array.from({ length: debt }, (_, i) => (
        <div
          key={`debt-${i}`}
          className="h-1.5 w-1.5 rounded-full bg-[var(--tomato-9)]"
        />
      ))}
      {/* Основные кружки прогресса */}
      {Array.from({ length: TOTAL_STAGES }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            i < progress
              ? progress >= TOTAL_STAGES
                ? 'bg-[var(--green-9)]'
                : 'bg-[var(--brand-9)]'
              : 'bg-[var(--gray-6)]',
          )}
        />
      ))}
    </div>
  );
}
