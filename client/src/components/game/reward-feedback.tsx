import type { RewardDisplay } from '@/types/game';

type RewardFeedbackProps = {
  reward: RewardDisplay;
};

export function RewardFeedback({ reward }: RewardFeedbackProps) {
  return (
    <div
      key={reward.key}
      className="flex flex-col items-center gap-1"
    >
      {/* XP group — value + multiplier animate together */}
      <div className="animate-reward-group flex items-center gap-1.5">
        <span className="text-sm font-semibold text-[var(--green-11)]">
          +{reward.xp} XP
        </span>
        {reward.doubleXp && (
          <span className="animate-multiplier-pop text-xs font-bold text-[var(--orange-10)]">
            x2
          </span>
        )}
        {reward.xpMultiplier > 1 && (
          <span className="animate-multiplier-pop text-xs font-bold text-[var(--orange-10)]">
            x{reward.xpMultiplier.toFixed(1)}
          </span>
        )}
      </div>

      {/* LP group — value + multiplier, slower animation */}
      {reward.lp > 0 && (
        <div className="animate-reward-group-slow flex items-center gap-1.5">
          <span className="text-xs font-medium text-[var(--amber-11)]">
            +{reward.lp} LP
          </span>
          {reward.lpMultiplier > 1 && (
            <span className="animate-multiplier-pop-slow text-xs font-bold text-[var(--red-10)]">
              x{reward.lpMultiplier.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Level up notification */}
      {reward.levelUp && (
        <span className="animate-reward-group text-sm font-bold text-[var(--accent-9)]">
          Уровень {reward.levelUp}!
        </span>
      )}
    </div>
  );
}
