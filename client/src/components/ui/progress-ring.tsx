import { cn } from '@/lib/utils';

type ProgressRingProps = {
  progress: number; // 0.0 — 1.0
  size?: number; // диаметр в px
  className?: string;
};

export function ProgressRing({ progress, size = 16, className }: ProgressRingProps) {
  if (progress <= 0) return null;

  const strokeWidth = 2;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(progress, 1);
  const offset = circumference * (1 - clampedProgress);
  const isComplete = clampedProgress >= 1;

  return (
    <svg
      width={size}
      height={size}
      className={cn('shrink-0', className)}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--gray-6)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isComplete ? 'var(--green-9)' : 'var(--brand-9)'}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
