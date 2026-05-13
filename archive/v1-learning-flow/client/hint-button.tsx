import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { getQuizHint } from '@/lib/api';

type HintButtonProps = {
  meaningId: number;
  disabled?: boolean;
};

export function HintButton({ meaningId, disabled }: HintButtonProps) {
  const [hints, setHints] = useState<string[]>([]);
  const [nextLevel, setNextLevel] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const requestHint = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const res = await getQuizHint(meaningId, nextLevel);
      if (res.hint) {
        setHints(prev => [...prev, res.hint!]);
        setNextLevel(prev => prev + 1);
        setHasMore(res.hasMore);
      } else {
        setHasMore(false);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [meaningId, nextLevel, hasMore, loading]);

  return (
    <div className="flex flex-col items-center gap-2">
      <AnimatePresence>
        {hints.map((hint, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full rounded-lg bg-[var(--blue-3)] px-3 py-2 text-center text-sm text-[var(--blue-11)]"
          >
            {hint}
          </motion.div>
        ))}
      </AnimatePresence>
      {hasMore && (
        <Button
          variant="link"
          size="sm"
          disabled={disabled || loading}
          onClick={requestHint}
          className="text-[var(--blue-11)]"
        >
          {hints.length === 0 ? 'Подсказка' : 'Ещё подсказка'}
        </Button>
      )}
    </div>
  );
}
