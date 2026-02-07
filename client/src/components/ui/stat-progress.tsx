import { cn } from '@/lib/utils';

type StatProgressProps = {
  label: string;
  value: string;
  /** 0–100 */
  percent: number;
  className?: string;
} & (
  | { variant?: 'default' }
  | {
      variant: 'segmented';
      segments: { widthClass: string; activeColor: string; inactiveColor: string; isActive: boolean }[];
      markerPercent: number;
    }
);

export function StatProgress(props: StatProgressProps) {
  const { label, value, percent, className } = props;
  const isSegmented = props.variant === 'segmented';

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-[var(--gray-11)]">{value}</span>
      </div>

      {isSegmented ? (
        <div className="relative mt-1.5 h-2 w-full">
          <div className="absolute inset-0 flex overflow-hidden rounded-full">
            {props.segments.map((seg, i) => (
              <div
                key={i}
                className={cn('h-full', seg.widthClass)}
                style={{ backgroundColor: seg.isActive ? seg.activeColor : seg.inactiveColor }}
              />
            ))}
          </div>
          <div
            className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-white shadow"
            style={{ left: `clamp(2px, ${props.markerPercent}%, calc(100% - 2px))` }}
          />
        </div>
      ) : (
        <div className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full bg-[var(--gray-3)]">
          <div
            className="h-full bg-[var(--brand-9)] transition-all"
            style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
          />
        </div>
      )}
    </div>
  );
}
