import { motion, useMotionValue, useTransform, AnimatePresence, type PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import type { ReviewFeedWord } from '@/types/api';

type Action = 'known' | 'unknown' | 'snooze';

type WordStackProps = {
  word: ReviewFeedWord;
  meaningIndex: number;
  onSwipe: (action: Action) => void;
  onUndo: () => void;
};

const SWIPE_THRESHOLD_X = 110;
const SWIPE_THRESHOLD_Y = 130;

/**
 * Стопка значений одного слова. Под верхней карточкой только meaning'и
 * того же слова (никаких других слов — карусель слов делается на уровне
 * ReviewPage через AnimatePresence).
 *
 * Жесты на верхней карте:
 *   вправо — знаю, влево — не знаю,
 *   вверх — отложить (skip всей стопки), вниз — назад (undo).
 *
 * При смене meaningIndex анимируется только верхняя карта (горизонтальный
 * exit), остальные подтягиваются вверх.
 */
export function WordStack({ word, meaningIndex, onSwipe, onUndo }: WordStackProps) {
  const meaning = word.meanings[meaningIndex];
  if (!meaning) return null;

  const totalMeanings = word.meanings.length;
  const remainingBehind = word.meanings.slice(meaningIndex + 1, meaningIndex + 3);

  return (
    <div className="relative h-[60vh] w-full">
      {/* Фантомы — только meaning'и ТОГО ЖЕ слова, до 2 шт. */}
      {remainingBehind.map((m, idx) => (
        <div
          key={`ghost-${m.meaningId}`}
          className="absolute inset-0 flex flex-col"
          style={{
            zIndex: 100 - (idx + 1),
            transform: `scale(${1 - (idx + 1) * 0.04}) translateY(${(idx + 1) * 8}px)`,
            opacity: 1 - (idx + 1) * 0.3,
          }}
        >
          <Card className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
            <div className="text-2xl font-bold opacity-70">{word.word}</div>
          </Card>
        </div>
      ))}

      {/* Верхняя интерактивная карточка. AnimatePresence обеспечивает
          горизонтальный exit при смене meaning внутри слова. */}
      <AnimatePresence mode="popLayout" initial={false}>
        <TopCard
          key={`top-${meaning.meaningId}`}
          word={word.word}
          transcription={word.transcription}
          meaningIndex={meaningIndex}
          totalMeanings={totalMeanings}
          translation={meaning.translation}
          partOfSpeech={meaning.partOfSpeech}
          cefr={meaning.cefr}
          example={meaning.example}
          onSwipe={onSwipe}
          onUndo={onUndo}
        />
      </AnimatePresence>
    </div>
  );
}

type TopCardProps = {
  word: string;
  transcription: string | null;
  meaningIndex: number;
  totalMeanings: number;
  translation: string;
  partOfSpeech: string;
  cefr: string | null;
  example: { en: string; ru: string } | null;
  onSwipe: (action: Action) => void;
  onUndo: () => void;
};

function TopCard({
  word,
  transcription,
  meaningIndex,
  totalMeanings,
  translation,
  partOfSpeech,
  cefr,
  example,
  onSwipe,
  onUndo,
}: TopCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);

  const knownOpacity = useTransform(x, [40, 140], [0, 1]);
  const unknownOpacity = useTransform(x, [-140, -40], [1, 0]);
  const skipOpacity = useTransform(y, [-140, -40], [1, 0]);
  const undoOpacity = useTransform(y, [40, 140], [0, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset } = info;
    if (offset.x > SWIPE_THRESHOLD_X) onSwipe('known');
    else if (offset.x < -SWIPE_THRESHOLD_X) onSwipe('unknown');
    else if (offset.y < -SWIPE_THRESHOLD_Y) onSwipe('snooze');
    else if (offset.y > SWIPE_THRESHOLD_Y) onUndo();
  };

  return (
    <motion.div
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      style={{ x, y, rotate, zIndex: 100 }}
      className="absolute inset-0 flex flex-col"
    >
      <Card className="relative flex flex-1 flex-col gap-4 overflow-hidden px-6 py-8 text-center">
        <motion.div
          style={{ opacity: knownOpacity }}
          className="pointer-events-none absolute right-4 top-4 rotate-12 rounded border-2 border-[var(--green-9)] px-3 py-1 text-sm font-bold uppercase tracking-wider text-[var(--green-11)]"
        >
          Знаю
        </motion.div>
        <motion.div
          style={{ opacity: unknownOpacity }}
          className="pointer-events-none absolute left-4 top-4 -rotate-12 rounded border-2 border-[var(--red-9)] px-3 py-1 text-sm font-bold uppercase tracking-wider text-[var(--red-11)]"
        >
          Учить
        </motion.div>
        <motion.div
          style={{ opacity: skipOpacity }}
          className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded border-2 border-[var(--gray-9)] px-3 py-1 text-sm font-bold uppercase tracking-wider text-[var(--gray-11)]"
        >
          Отложить
        </motion.div>
        <motion.div
          style={{ opacity: undoOpacity }}
          className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded border-2 border-[var(--gray-9)] px-3 py-1 text-sm font-bold uppercase tracking-wider text-[var(--gray-11)]"
        >
          Назад
        </motion.div>

        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--gray-11)]">
            {totalMeanings > 1 && (
              <span>{meaningIndex + 1} / {totalMeanings}</span>
            )}
            {cefr && <span>· {cefr.toUpperCase()}</span>}
            <span>· {partOfSpeech}</span>
          </div>
          <div className="text-3xl font-bold">{word}</div>
          {transcription && (
            <div className="text-sm text-[var(--gray-11)]">[{transcription}]</div>
          )}
          <div className="mt-2 text-lg text-[var(--gray-12)]">{translation}</div>
        </div>

        {example && (
          <div className="border-t border-[var(--gray-5)] pt-3 text-left">
            <div className="text-sm">{example.en}</div>
            <div className="text-sm text-[var(--gray-11)]">{example.ru}</div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
