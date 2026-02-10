import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// ─── Types ──────────────────────────────────────────────────────────────────

type MilestoneData = {
  id: string;
  type: string;
  threshold: number;
  title: string;
  description: string;
  gemsReward: number;
  icon: string;
};

type MilestoneModalProps = {
  milestone: MilestoneData | null;
  onClose: () => void;
};

// ─── Component ──────────────────────────────────────────────────────────────

export function MilestoneModal({ milestone, onClose }: MilestoneModalProps) {
  if (!milestone) return null;

  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Dimmed background */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal content */}
          <motion.div
            className="relative z-10 mx-6 flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl bg-[var(--gray-1)] p-8 shadow-xl"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            {/* Icon */}
            <motion.div
              className="text-6xl"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
            >
              {milestone.icon}
            </motion.div>

            {/* Title */}
            <h2 className="text-center text-xl font-bold text-[var(--gray-12)]">
              {milestone.title}
            </h2>

            {/* Description */}
            <p className="text-center text-sm text-[var(--gray-11)]">
              {milestone.description}
            </p>

            {/* Gems reward */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.25 }}
            >
              <Badge variant="primary" className="px-4 py-1.5 text-base">
                +{milestone.gemsReward} {'\u{1F48E}'}
              </Badge>
            </motion.div>

            {/* Continue button */}
            <Button
              variant="default"
              className="mt-2 w-full"
              onClick={onClose}
            >
              Продолжить
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
