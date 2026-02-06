type LevelIndicatorProps = {
  level: number;
  onClick?: () => void;
};

export function LevelIndicator({ level, onClick }: LevelIndicatorProps) {
  return (
    <button
      onClick={onClick}
      className="flex h-12 items-center gap-0.5 rounded-full bg-[var(--accent-3)] px-3 active:bg-[var(--accent-4)]"
    >
      <span className="text-xl font-bold text-[var(--accent-11)]">{level}</span>
      <span className="text-xs text-[var(--gray-11)]">ур.</span>
    </button>
  );
}
