import { motion, AnimatePresence } from 'framer-motion';

type WordDisplayProps = {
  word: string;
  originalForm?: string | null;
  transcription?: string | null;
  meaningId: number;
  // Для отключения анимации первого вопроса
  skipInitialAnimation?: boolean;
};

// Адаптивный размер шрифта в зависимости от длины слова
function getFontSize(word: string): string {
  if (word.length > 14) {
    const maxSize = Math.max(1.5, 2.25 - (word.length - 14) * 0.08);
    return `clamp(1.25rem, 8vw, ${maxSize}rem)`;
  }
  if (word.length > 10) {
    const maxSize = 2.25 - (word.length - 10) * 0.05;
    return `clamp(1.5rem, 9vw, ${maxSize}rem)`;
  }
  return 'clamp(1.75rem, 10vw, 2.25rem)';
}

export function WordDisplay({
  word,
  originalForm,
  transcription,
  meaningId,
  skipInitialAnimation = false,
}: WordDisplayProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={meaningId}
        className="flex flex-col items-center"
        initial={skipInitialAnimation ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Оригинальная форма сверху мелко (shoes при word=shoe) */}
        {originalForm && (
          <span className="mb-1 text-xs text-[var(--gray-10)]">
            {originalForm}
          </span>
        )}

        <h2
          className="max-w-full break-words px-4 text-center font-bold"
          style={{ fontSize: getFontSize(word) }}
        >
          {word}
        </h2>

        {transcription && (
          <span className="mt-1 text-sm text-[var(--gray-10)]">
            [{transcription}]
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
