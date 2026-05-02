import { motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import type { ReviewFeedCard } from '@/types/api';

type Action = 'known' | 'unknown' | 'snooze';

type ReviewCardProps = {
  card: ReviewFeedCard;
  onSwipe: (action: Action) => void;
  isTop: boolean;
  /** Смещение по z для эффекта стопки. */
  offset: number;
};

const SWIPE_THRESHOLD_X = 110;
const SWIPE_THRESHOLD_Y = 130;

export function ReviewCard({ card, onSwipe, isTop, offset }: ReviewCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);

  // Hint-индикаторы (полупрозрачные подписи известно/неизвестно/отложить).
  const knownOpacity = useTransform(x, [40, 140], [0, 1]);
  const unknownOpacity = useTransform(x, [-140, -40], [1, 0]);
  const snoozeOpacity = useTransform(y, [40, 140], [0, 1]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const { offset: drag } = info;
    if (drag.x > SWIPE_THRESHOLD_X) {
      onSwipe('known');
    } else if (drag.x < -SWIPE_THRESHOLD_X) {
      onSwipe('unknown');
    } else if (drag.y > SWIPE_THRESHOLD_Y) {
      onSwipe('snooze');
    }
    // Если свайп не достиг порога — framer-motion сам анимирует обратно
    // благодаря dragSnapToOrigin.
  };

  return (
    <motion.div
      drag={isTop}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={handleDragEnd}
      style={{
        x: isTop ? x : 0,
        y: isTop ? y : 0,
        rotate: isTop ? rotate : 0,
        zIndex: 100 - offset,
      }}
      animate={{
        scale: 1 - offset * 0.04,
        y: offset * 8,
      }}
      className="absolute inset-0 flex flex-col"
    >
      <Card className="relative flex flex-1 flex-col gap-4 px-6 py-8 text-center overflow-hidden">
        {/* Свайп-подписи */}
        {isTop && (
          <>
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
              style={{ opacity: snoozeOpacity }}
              className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded border-2 border-[var(--gray-9)] px-3 py-1 text-sm font-bold uppercase tracking-wider text-[var(--gray-11)]"
            >
              Отложить
            </motion.div>
          </>
        )}

        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          {card.cefr && (
            <span className="text-xs uppercase tracking-wide text-[var(--gray-11)]">
              {card.cefr.toUpperCase()}
            </span>
          )}
          <div className="text-3xl font-bold">{card.word}</div>
          {card.transcription && (
            <div className="text-sm text-[var(--gray-11)]">[{card.transcription}]</div>
          )}
          <div className="mt-2 text-lg text-[var(--gray-12)]">{card.translation}</div>
        </div>

        {card.example && (
          <div className="border-t border-[var(--gray-5)] pt-3 text-left">
            <div className="text-sm">{card.example.en}</div>
            <div className="text-sm text-[var(--gray-11)]">{card.example.ru}</div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
