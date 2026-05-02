import { motion } from 'framer-motion';

type MnemonicCardProps = {
  text: string;
};

export function MnemonicCard({ text }: MnemonicCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="rounded-lg bg-[var(--amber-3)] px-3 py-2.5"
    >
      <p className="text-xs font-medium text-[var(--amber-11)]">Запоминалка</p>
      <p className="mt-0.5 text-sm text-[var(--amber-12)]">{text}</p>
    </motion.div>
  );
}
