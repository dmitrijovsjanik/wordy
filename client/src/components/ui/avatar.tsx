import { cn } from '@/lib/utils';

type AvatarProps = {
  src?: string | null;
  fallback: string;
  size?: number;
  className?: string;
  onClick?: () => void;
};

export function Avatar({ src, fallback, size = 48, className, onClick }: AvatarProps) {
  const initials = fallback.slice(0, 2).toUpperCase();

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-9)]',
        onClick && 'cursor-pointer',
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          src={src}
          alt={fallback}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="font-semibold text-white"
          style={{ fontSize: size * 0.4 }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
