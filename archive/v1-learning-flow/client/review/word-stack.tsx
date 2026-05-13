import { useEffect, useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  AnimatePresence,
  animate,
  type PanInfo,
} from 'framer-motion';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { LearningCard, type LearningCardMeaning } from '@/components/game/learning-card';
import type { ReviewFeedWord } from '@/types/api';

type Action = 'known' | 'unknown' | 'snooze';

type WordStackProps = {
  word: ReviewFeedWord;
  onSwipe: (action: Action) => void;
  /** Жест «вниз = откат». Передавайте no-op чтобы заблокировать (embedded review). */
  onUndo: () => void;
};

// Пороги по motion value (= позиции карты, не пути пальца). С dragElastic=0.6
// палец проходит ~1.66× больше, чем motion value, поэтому x=70 ≈ ~117px пальцем.
const SWIPE_THRESHOLD_X = 70;
const SWIPE_THRESHOLD_Y = 90;
const FLY_AWAY_DISTANCE = 800;
const FLY_AWAY_DURATION = 0.22;

/**
 * Карточка обзора L0 (знакомство с новым словом). По дизайну Wordy 2.2 (Figma 5120:7270).
 *
 * Лицевая часть карточки — слово, транскрипция, список значений с примерами
 * и переводами. Карточка не флипается; полный список значений открывается
 * в bottom-sheet по кнопке «Показать все N».
 *
 * Жесты сохранены: вправо = знаю, влево = не знаю, вверх = отложить, вниз = откат.
 * onUndo no-op блокирует жест «вниз» (используется в embedded review).
 */
export function WordStack({ word, onSwipe, onUndo }: WordStackProps) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <AnimatePresence mode="popLayout" initial={false}>
        <TopCard
          key={`top-${word.wordId}`}
          word={word}
          onSwipe={onSwipe}
          onUndo={onUndo}
        />
      </AnimatePresence>
    </div>
  );
}

type TopCardProps = {
  word: ReviewFeedWord;
  onSwipe: (action: Action) => void;
  onUndo: () => void;
};

function TopCard({ word, onSwipe, onUndo }: TopCardProps) {
  const [allMeaningsOpen, setAllMeaningsOpen] = useState(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);

  const originX = useMotionValue(50);
  const originY = useMotionValue(50);

  const inDropZone = useMotionValue(0);
  const dropZoneSpring = useSpring(inDropZone, { stiffness: 380, damping: 32 });

  useEffect(() => {
    const unsub = x.on('change', (val) => {
      inDropZone.set(Math.abs(val) >= SWIPE_THRESHOLD_X ? 1 : 0);
    });
    return unsub;
  }, [x, inDropZone]);

  // Ripple-заливка из точки касания.
  const fillBg = useTransform([x, originX, originY, dropZoneSpring], (latest) => {
    const xv = latest[0] as number;
    const ox = latest[1] as number;
    const oy = latest[2] as number;
    const lock = latest[3] as number;
    if (xv === 0 && lock < 0.01) {
      return 'radial-gradient(circle at 50% 50%, transparent 0%, transparent 100%)';
    }
    const k = Math.min(1, Math.abs(xv) / SWIPE_THRESHOLD_X);
    const partialRadius = k * 75;
    const fullRadius = 220;
    const radius = partialRadius + (fullRadius - partialRadius) * lock;
    const isGreen = xv > 0;
    const colorCenter = isGreen ? 'var(--green-5)' : 'var(--red-5)';
    const colorMid = isGreen ? 'var(--green-4)' : 'var(--red-4)';
    return `radial-gradient(circle at ${ox}% ${oy}%, ${colorCenter} 0%, ${colorMid} ${radius * 0.5}%, transparent ${radius}%)`;
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    originX.set(((e.clientX - rect.left) / rect.width) * 100);
    originY.set(((e.clientY - rect.top) / rect.height) * 100);
  };

  const handleDragEnd = (_: unknown, _info: PanInfo) => {
    const xv = x.get();
    const yv = y.get();
    if (xv > SWIPE_THRESHOLD_X) {
      animate(x, FLY_AWAY_DISTANCE, { duration: FLY_AWAY_DURATION, onComplete: () => onSwipe('known') });
      return;
    }
    if (xv < -SWIPE_THRESHOLD_X) {
      animate(x, -FLY_AWAY_DISTANCE, { duration: FLY_AWAY_DURATION, onComplete: () => onSwipe('unknown') });
      return;
    }
    if (yv < -SWIPE_THRESHOLD_Y) {
      animate(y, -FLY_AWAY_DISTANCE, { duration: FLY_AWAY_DURATION, onComplete: () => onSwipe('snooze') });
      return;
    }
    if (yv > SWIPE_THRESHOLD_Y) {
      animate(y, FLY_AWAY_DISTANCE, { duration: FLY_AWAY_DURATION, onComplete: () => onUndo() });
      return;
    }
  };

  const meaningsCount = word.meanings.length;

  return (
    <>
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragSnapToOrigin
        dragElastic={0.6}
        onPointerDown={handlePointerDown}
        onDragEnd={handleDragEnd}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18 }}
        style={{ x, y, rotate, zIndex: 100 }}
        className="absolute inset-0 flex flex-col"
      >
        <LearningCard
          prompt="Решите, знаете ли вы это слово"
          word={word.text}
          transcription={word.transcription ?? null}
          meanings={toLearningMeanings(word)}
          revealed
          audioWord={word.text}
          onShowAll={() => setAllMeaningsOpen(true)}
          backgroundOverlay={
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: fillBg }}
            />
          }
        />
      </motion.div>

      {/* Bottom-sheet со всеми значениями (та же карточка, но со скроллом). */}
      <Drawer open={allMeaningsOpen} onOpenChange={setAllMeaningsOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{word.text}</DrawerTitle>
            <DrawerDescription>Все значения слова</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8">
            <LearningCard
              prompt="Решите, знаете ли вы это слово"
              word={word.text}
              transcription={word.transcription ?? null}
              meanings={toLearningMeanings(word)}
              revealed
              audioWord={word.text}
              hideShowAll
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLearningMeanings(word: ReviewFeedWord): LearningCardMeaning[] {
  return word.meanings.map((m) => ({
    meaningId: m.meaningId,
    translation: m.translation,
    partOfSpeech: word.partOfSpeech,
    example: m.exampleEn
      ? { en: m.exampleEn, ru: m.exampleRu ?? '' }
      : null,
  }));
}
