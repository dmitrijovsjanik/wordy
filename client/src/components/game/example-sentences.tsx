import { motion } from 'framer-motion';

type ExampleSentencesProps = {
  examples: { en: string; ru: string }[];
};

const MAX_EXAMPLES = 2;

export function ExampleSentences({ examples }: ExampleSentencesProps) {
  const visibleExamples = examples.slice(0, MAX_EXAMPLES);

  if (visibleExamples.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2"
    >
      {visibleExamples.map((example, idx) => (
        <div
          key={idx}
          className="rounded-lg bg-[var(--gray-3)] px-3 py-2.5"
        >
          <p className="text-sm font-semibold text-[var(--gray-12)]">
            {example.en}
          </p>
          <p className="mt-0.5 text-xs text-[var(--gray-11)]">
            {example.ru}
          </p>
        </div>
      ))}
    </motion.div>
  );
}
