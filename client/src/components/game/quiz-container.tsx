import { motion, AnimatePresence } from 'framer-motion';
import type { ReactNode } from 'react';

type QuizContainerProps = {
  children: ReactNode;
  questionKey: string | number;
};

/**
 * Fade-анимация при смене вопроса или режима
 */
export function QuizContainer({ children, questionKey }: QuizContainerProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={questionKey}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
