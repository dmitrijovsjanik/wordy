import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import type { ReviewFeedWord } from '@/types/api';

type Action = 'known' | 'unknown' | 'snooze';

type WordStackProps = {
  /** Текущее слово (стопка). */
  word: ReviewFeedWord;
  /** Какой meaning сейчас сверху стопки (0..meanings.length-1). */
  meaningIndex: number;
  /** Следующее слово для эффекта «снизу прилетает». null если очередь пуста. */
  nextWord: ReviewFeedWord | null;
  onSwipe: (action: Action) => void;
  onUndo: () => void;
};

const SWIPE_THRESHOLD_X = 110;
const SWIPE_THRESHOLD_Y = 130;

/**
 * Стопка значений одного слова. Жесты:
 *   - вправо: знаю (текущее значение)
 *   - влево:  не знаю (текущее значение)
 *   - вверх:  skip всей стопки
 *   - вниз:   undo последнего действия
 *
 * Под верхней карточкой видны «фантомы»: следующие значения этого же слова
 * (для эффекта внутренней стопки) + первое значение следующего слова.
 */
export function WordStack({ word, meaningIndex, nextWord, onSwipe, onUndo }: WordStackProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);

  const knownOpacity = useTransform(x, [40, 140], [0, 1]);
  const unknownOpacity = useTransform(x, [-140, -40], [1, 0]);
  const skipOpacity = useTransform(y, [-140, -40], [1, 0]);
  const undoOpacity = useTransform(y, [40, 140], [0, 1]);

  const meaning = word.meanings[meaningIndex];
  if (!meaning) return null;

  const totalMeanings = word.meanings.length;
  const remainingInWord = totalMeanings - meaningIndex - 1;

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset } = info;
    if (offset.x > SWIPE_THRESHOLD_X) onSwipe('known');
    else if (offset.x < -SWIPE_THRESHOLD_X) onSwipe('unknown');
    else if (offset.y < -SWIPE_THRESHOLD_Y) onSwipe('snooze');
    else if (offset.y > SWIPE_THRESHOLD_Y) onUndo();
  };

  // Фантомы: 1-2 ghost-карточки сзади. Если у слова есть ещё meaning'и — рисуем.
  // Иначе — фантом следующего слова.
  const ghosts: Array<{ key: string; label: string; sub: string }> = [];
  for (let i = 1; i <= 2; i++) {
    const nextInWord = word.meanings[meaningIndex + i];
    if (nextInWord) {
      ghosts.push({
        key: `m-${nextInWord.meaningId}`,
        label: word.word,
        sub: nextInWord.translation,
      });
    } else if (nextWord && i === 1 + (totalMeanings - meaningIndex - 1)) {
      // Когда meaning'и слова кончились — фантом нового слова.
      const firstNext = nextWord.meanings[0];
      if (firstNext) {
        ghosts.push({
          key: `w-${nextWord.wordId}`,
          label: nextWord.word,
          sub: firstNext.translation,
        });
      }
    }
  }

  return (
    <div className="relative h-[60vh] w-full">
      {/* Фантомы сзади. */}
      {ghosts.map((g, idx) => (
        <div
          key={g.key}
          className="absolute inset-0 flex flex-col"
          style={{
            zIndex: 100 - (idx + 1),
            transform: `scale(${1 - (idx + 1) * 0.04}) translateY(${(idx + 1) * 8}px)`,
            opacity: 1 - (idx + 1) * 0.25,
          }}
        >
          <Card className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
            <div className="text-2xl font-bold opacity-70">{g.label}</div>
            <div className="text-sm text-[var(--gray-11)]">{g.sub}</div>
          </Card>
        </div>
      ))}

      {/* Верхняя интерактивная карточка. key включает meaningId — при смене
          framer-motion перерисовывает с нужной анимацией. */}
      <motion.div
        key={`top-${word.wordId}-${meaning.meaningId}`}
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragSnapToOrigin
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{ x, y, rotate, zIndex: 100 }}
        className="absolute inset-0 flex flex-col"
      >
        <Card className="relative flex flex-1 flex-col gap-4 overflow-hidden px-6 py-8 text-center">
          {/* Свайп-подписи */}
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
                <span>
                  {meaningIndex + 1} / {totalMeanings}
                </span>
              )}
              {meaning.cefr && <span>· {meaning.cefr.toUpperCase()}</span>}
              <span>· {meaning.partOfSpeech}</span>
            </div>
            <div className="text-3xl font-bold">{word.word}</div>
            {word.transcription && (
              <div className="text-sm text-[var(--gray-11)]">[{word.transcription}]</div>
            )}
            <div className="mt-2 text-lg text-[var(--gray-12)]">{meaning.translation}</div>
            {remainingInWord > 0 && (
              <div className="mt-1 text-xs text-[var(--gray-10)]">
                ещё {remainingInWord} {remainingInWord === 1 ? 'значение' : 'значения'}
              </div>
            )}
          </div>

          {meaning.example && (
            <div className="border-t border-[var(--gray-5)] pt-3 text-left">
              <div className="text-sm">{meaning.example.en}</div>
              <div className="text-sm text-[var(--gray-11)]">{meaning.example.ru}</div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
