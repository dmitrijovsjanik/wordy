import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

type DoubleXpBackgroundProps = {
  timeLimitMs: number;
  onExpired: () => void;
};

export function DoubleXpBackground({ timeLimitMs, onExpired }: DoubleXpBackgroundProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const expiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  useEffect(() => {
    const start = Date.now();
    expiredRef.current = false;
    let rafId: number;

    function tick() {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / timeLimitMs);
      const el = barRef.current;

      if (el) {
        // transform: scaleX — GPU-ускоренное свойство, надёжно работает на iOS
        el.style.transform = `scaleX(${remaining})`;
      }

      if (remaining <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpiredRef.current();
        }
        return;
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [timeLimitMs]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
    >
      {/* Progress bar shrinking right to left */}
      <div
        ref={barRef}
        className="absolute inset-y-0 left-0 w-full origin-left bg-[var(--green-1)] will-change-transform"
      />
    </motion.div>
  );
}
