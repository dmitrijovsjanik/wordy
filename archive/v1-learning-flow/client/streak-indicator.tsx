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
  const showStreak = streak >= 3;

  return (
    <AnimatePresence>
      {showStreak && (
        <motion.div
          key="streak-row"
          className="overflow-hidden"
          initial={skipInitialAnimation ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        >
          <div className="flex items-center justify-center overflow-visible">
          <div className="relative">
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
              className="relative z-10 flex h-8 items-center justify-center rounded-full border border-[var(--orange-6)] bg-[var(--orange-3)] px-3"
              initial={false}
              animate={bounceKey === 0 ? {} : {
                scaleX: [1, 1.15, 0.95, 1],
                scaleY: [1, 0.92, 1.04, 1],
                filter: ['brightness(1)', 'brightness(1.8)', 'brightness(1.15)', 'brightness(1)'],
              }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <span className="whitespace-nowrap text-xs font-medium tracking-wide text-[var(--orange-11)]">
                {streak} подряд!
              </span>
            </motion.div>
          </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
