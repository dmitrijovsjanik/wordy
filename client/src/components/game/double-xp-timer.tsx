import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

type DoubleXpTimerProps = {
  timeLimitMs: number;
  onExpired: () => void;
};

export function DoubleXpTimer({ timeLimitMs, onExpired }: DoubleXpTimerProps) {
  const ringRef = useRef<HTMLDivElement>(null);
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
      const progress = remaining * 100;
      const el = ringRef.current;

      if (el) {
        const deg = progress * 3.6;
        const startDeg = 360 - deg;
        const color = progress < 30 ? 'var(--red-9)' : 'var(--green-9)';
        el.style.background =
          `conic-gradient(from ${startDeg}deg, ${color} ${deg}deg, var(--gray-4) ${deg}deg)`;
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
      key="double-xp-timer"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className="relative h-8 w-8"
    >
      <div
        ref={ringRef}
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, var(--green-9) 360deg, var(--gray-4) 360deg)`,
        }}
      />
      <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-[var(--gray-1)]">
        <span className="text-[11px] font-bold leading-none text-[var(--green-11)]">x2</span>
      </div>
    </motion.div>
  );
}
