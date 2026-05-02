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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PassiveRecallApiQuestion } from '@/types/api';

type PassiveRecallCardProps = {
  question: PassiveRecallApiQuestion;
  disabled?: boolean;
  /** Вызывается после короткого ✓/✗ feedback (500ms). knew=true → свайп вправо. */
  onAnswer: (knew: boolean) => void;
};

// Полностью копирует параметры WordStack — тот же UX свайпа.
const SWIPE_THRESHOLD_X = 70;
const FLY_AWAY_DISTANCE = 800;
const FLY_AWAY_DURATION = 0.22;
const FEEDBACK_MS = 500;

const CARD_SHADOW = 'shadow-[0_10px_30px_-5px_rgba(0,0,0,0.18)]';

/**
 * Passive recall флешкарта (tier=passive). Визуал и поведение свайпа —
 * 1-в-1 как в WordStack на странице обзора. Отличие: 3D-флип между двумя
 * сторонами и контент.
 *
 *   Лицо:     слово     + example.en + «N из M»
 *   Обратная: перевод   + example.ru + «N из M»
 *
 * Тап переворачивает карточку в обе стороны, пока решение не принято.
 * Свайп активен только когда показана обратная сторона. После свайпа —
 * ✓/✗ overlay 500мс, потом onAnswer(knew).
 */
export function PassiveRecallCard({ question, disabled = false, onAnswer }: PassiveRecallCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [decision, setDecision] = useState<'known' | 'unknown' | null>(null);

  useEffect(() => {
    if (decision === null) return;
    const t = setTimeout(() => onAnswer(decision === 'known'), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [decision, onAnswer]);

  const dragEnabled = flipped && decision === null && !disabled;
  const canFlip = decision === null && !disabled;

  const handleSwipe = (action: 'known' | 'unknown') => {
    if (decision !== null) return;
    setDecision(action);
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div className="relative h-[60vh] w-full">
          <FlipCard
            question={question}
            flipped={flipped}
            dragEnabled={dragEnabled}
            decision={decision}
            onTap={() => canFlip && setFlipped((f) => !f)}
            onSwipe={handleSwipe}
          />
        </div>
      </div>

      {/* Кнопочный fallback — точное соответствие review-page. Цвета совпадают
          с ripple-заливкой при свайпе. Кнопки активны только когда показана
          обратная сторона (как и свайп) и решение ещё не принято. */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button
          variant="destructive"
          disabled={!dragEnabled}
          onClick={() => handleSwipe('unknown')}
          className="text-xs"
        >
          Учить
        </Button>
        <Button
          variant="success"
          disabled={!dragEnabled}
          onClick={() => handleSwipe('known')}
          className="text-xs"
        >
          Знаю
        </Button>
      </div>
    </div>
  );
}

// ─── FlipCard ────────────────────────────────────────────────────────────────

type FlipCardProps = {
  question: PassiveRecallApiQuestion;
  flipped: boolean;
  dragEnabled: boolean;
  decision: 'known' | 'unknown' | null;
  onTap: () => void;
  onSwipe: (action: 'known' | 'unknown') => void;
};

function FlipCard({ question, flipped, dragEnabled, decision, onTap, onSwipe }: FlipCardProps) {
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

  // Ripple-заливка из точки касания. Идентична WordStack.
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
    if (xv > SWIPE_THRESHOLD_X) {
      animate(x, FLY_AWAY_DISTANCE, { duration: FLY_AWAY_DURATION, onComplete: () => onSwipe('known') });
      return;
    }
    if (xv < -SWIPE_THRESHOLD_X) {
      animate(x, -FLY_AWAY_DISTANCE, { duration: FLY_AWAY_DURATION, onComplete: () => onSwipe('unknown') });
      return;
    }
  };

  return (
    <motion.div
      drag={dragEnabled ? true : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragSnapToOrigin
      dragElastic={0.6}
      onPointerDown={handlePointerDown}
      onDragEnd={handleDragEnd}
      onClick={onTap}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18 }}
      style={{ x, y, rotate, perspective: 1200, zIndex: 100 }}
      className="absolute inset-0 flex cursor-pointer flex-col"
    >
      {/* Контейнер флипа */}
      <motion.div
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.45, ease: 'easeInOut' }}
        style={{ transformStyle: 'preserve-3d' }}
        className="relative h-full w-full"
      >
        {/* Лицо */}
        <FaceCard
          fillBg={fillBg}
          showFill={dragEnabled}
          meaningIndex={question.meaningIndex}
          totalMeanings={question.totalMeanings}
          mainText={question.word}
          exampleText={question.example?.en ?? null}
          backFace={false}
        />

        {/* Обратная */}
        <FaceCard
          fillBg={fillBg}
          showFill={dragEnabled}
          meaningIndex={question.meaningIndex}
          totalMeanings={question.totalMeanings}
          mainText={question.translation}
          exampleText={question.example?.ru ?? null}
          backFace
        />
      </motion.div>

      {/* ✓/✗ overlay поверх обеих сторон. */}
      <AnimatePresence>
        {decision && (
          <motion.div
            key="decision-overlay"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
          >
            <div
              className={`flex h-28 w-28 items-center justify-center rounded-full text-6xl font-bold text-white ${
                decision === 'known' ? 'bg-[var(--green-9)]' : 'bg-[var(--red-9)]'
              }`}
            >
              {decision === 'known' ? '✓' : '✗'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── FaceCard — один из двух «листов» карточки ──────────────────────────────
//
// Структура совпадает с TopCard из WordStack: строка-метка с meaning-index,
// крупный текст по центру, разделитель + пример снизу. Контент отличается
// (на лицевой — слово+example.en, на обратной — перевод+example.ru).

type FaceCardProps = {
  fillBg: import('framer-motion').MotionValue<string>;
  /** Показывать ripple-заливку только когда свайп активен (т.е. на обратной). */
  showFill: boolean;
  meaningIndex: number;
  totalMeanings: number;
  mainText: string;
  exampleText: string | null;
  /** true → этот лист повёрнут на 180° относительно лица. */
  backFace: boolean;
};

function FaceCard({ fillBg, showFill, meaningIndex, totalMeanings, mainText, exampleText, backFace }: FaceCardProps) {
  return (
    <Card
      className={`absolute inset-0 flex flex-col gap-4 overflow-hidden px-6 py-8 text-center ${CARD_SHADOW}`}
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        ...(backFace ? { transform: 'rotateY(180deg)' } : {}),
      }}
    >
      {/* Ripple-заливка — только на той стороне, где доступен свайп. */}
      {showFill && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: fillBg }}
        />
      )}

      <div className="relative flex flex-1 flex-col items-center justify-center gap-2">
        {totalMeanings > 1 && (
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-[var(--gray-11)]">
            <span>{meaningIndex} / {totalMeanings}</span>
          </div>
        )}
        <div className="text-3xl font-bold">{mainText}</div>
      </div>

      {exampleText && (
        <div className="relative border-t border-[var(--gray-5)] pt-3 text-left">
          <div className="text-sm">{exampleText}</div>
        </div>
      )}
    </Card>
  );
}
