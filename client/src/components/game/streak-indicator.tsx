import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type StreakIndicatorProps = {
  streak: number;
  bounceKey: number;
  particleBurst: boolean;
  particleFading: boolean;
  // Для пропуска анимации появления если streak уже >= 3 при монтировании
  skipInitialAnimation?: boolean;
};

export function StreakIndicator({
  streak,
  bounceKey,
  particleBurst,
  particleFading,
  skipInitialAnimation = false,
}: StreakIndicatorProps) {
  if (streak < 3) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="streak"
        className="relative"
        initial={skipInitialAnimation ? false : { opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      >
        {/* Particles */}
        <div className={cn(
          'pointer-events-none absolute inset-x-0 -top-2 z-0 overflow-visible',
          particleBurst && 'streak-particles-burst',
          particleBurst && particleFading && 'streak-particles-fading',
        )}>
          <span className="streak-particle" style={{ left: '20%', animationDelay: '0s' }} />
          <span className="streak-particle" style={{ left: '40%', animationDelay: '0.5s' }} />
          <span className="streak-particle" style={{ left: '60%', animationDelay: '1.0s' }} />
          <span className="streak-particle" style={{ left: '80%', animationDelay: '0.3s' }} />
          <span className="streak-particle" style={{ left: '50%', animationDelay: '0.7s' }} />
          <span className="streak-particle" style={{ left: '30%', animationDelay: '1.3s' }} />
          <span className="streak-particle" style={{ left: '70%', animationDelay: '1.6s' }} />
        </div>

        {/* Glow layers */}
        <div className="streak-glow" />

        <motion.div
          key={bounceKey}
          className="relative z-10 flex h-8 items-center justify-center rounded-full border border-orange-500/20 bg-orange-950/80 px-3.5 shadow-[inset_0_0_10px_rgba(251,146,60,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]"
          initial={false}
          animate={bounceKey === 0 ? {} : {
            scaleX: [1, 1.15, 0.95, 1],
            scaleY: [1, 0.92, 1.04, 1],
            filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1.15)', 'brightness(1)'],
          }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <span className="whitespace-nowrap text-xs font-medium tracking-wide text-[var(--red-11)]">
            {streak} подряд!
          </span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
