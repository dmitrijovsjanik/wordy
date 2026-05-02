import { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring, animate, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import type { PassiveRecallApiQuestion } from '@/types/api';

type PassiveRecallCardProps = {
  question: PassiveRecallApiQuestion;
  disabled?: boolean;
  /** Вызывается после короткого ✓/✗ feedback (500ms). knew=true → свайп вправо. */
  onAnswer: (knew: boolean) => void;
};

const SWIPE_THRESHOLD_X = 70;
const FLY_AWAY_DISTANCE = 800;
const FLY_AWAY_DURATION = 0.22;
const FEEDBACK_MS = 500;

const CARD_SHADOW = 'shadow-[0_10px_30px_-5px_rgba(0,0,0,0.18)]';

/**
 * Passive recall флешкарта (tier=passive). Лицо: слово + пример (en).
 * Тап → флип → обратная: перевод + пример (ru) + кнопка раскрытия мнемоники.
 * Свайп вправо = «знал», влево = «не знал». После свайпа — короткий ✓/✗
 * 500мс, затем onAnswer().
 *
 * Свайп активен ТОЛЬКО после переворота. До флипа карточка статичная и
 * реагирует только на тап (переворачивает её).
 */
export function PassiveRecallCard({ question, disabled = false, onAnswer }: PassiveRecallCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [decision, setDecision] = useState<'known' | 'unknown' | null>(null);

  // После принятия решения — показываем ✓/✗, ждём FEEDBACK_MS, вызываем onAnswer.
  useEffect(() => {
    if (decision === null) return;
    const t = setTimeout(() => onAnswer(decision === 'known'), FEEDBACK_MS);
    return () => clearTimeout(t);
  }, [decision, onAnswer]);

  // Свайп — только когда показана обратная (перевод) и решение ещё не принято.
  // Тап — переворачивает в обе стороны, пока решение не принято.
  const dragEnabled = flipped && decision === null && !disabled;
  const canFlip = decision === null && !disabled;

  return (
    <SwipeableCard
      flipped={flipped}
      dragEnabled={dragEnabled}
      decision={decision}
      onTap={() => canFlip && setFlipped((f) => !f)}
      onSwipe={(action) => setDecision(action)}
      front={<FrontFace question={question} />}
      back={<BackFace question={question} />}
    />
  );
}

// ─── Сама свайп-карта с флипом ──────────────────────────────────────────────

type SwipeableCardProps = {
  flipped: boolean;
  dragEnabled: boolean;
  decision: 'known' | 'unknown' | null;
  onTap: () => void;
  onSwipe: (action: 'known' | 'unknown') => void;
  front: React.ReactNode;
  back: React.ReactNode;
};

function SwipeableCard({ flipped, dragEnabled, decision, onTap, onSwipe, front, back }: SwipeableCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-12, 12]);

  // Бистабильный флаг «карта в зоне дропа».
  const inDropZone = useMotionValue(0);
  const dropZoneSpring = useSpring(inDropZone, { stiffness: 380, damping: 32 });

  useEffect(() => {
    const unsub = x.on('change', (val) => {
      inDropZone.set(Math.abs(val) >= SWIPE_THRESHOLD_X ? 1 : 0);
    });
    return unsub;
  }, [x, inDropZone]);

  // Заливка-индикатор зелёным/красным при свайпе. Появляется только когда
  // карточка перевёрнута (на лицевой стороне свайп выключен).
  const fillBg = useTransform([x, dropZoneSpring], (latest) => {
    const xv = latest[0] as number;
    const lock = latest[1] as number;
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
    return `radial-gradient(circle at 50% 50%, ${colorCenter} 0%, ${colorMid} ${radius * 0.5}%, transparent ${radius}%)`;
  });

  const handleDragEnd = () => {
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
    <div className="relative h-[60vh] w-full" style={{ perspective: '1200px' }}>
      <motion.div
        drag={dragEnabled ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragSnapToOrigin
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        onClick={() => !flipped && onTap()}
        style={{ x, rotate }}
        className={`absolute inset-0 ${flipped ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
      >
        {/* Контейнер флипа: rotateY 0 ↔ 180. transformStyle preserve-3d для
            корректного отображения двух сторон в 3D-пространстве. */}
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: 'easeInOut' }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative h-full w-full"
        >
          {/* Лицо */}
          <Card
            className={`absolute inset-0 flex flex-col gap-4 overflow-hidden px-6 py-8 text-center ${CARD_SHADOW}`}
            style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
          >
            {front}
          </Card>

          {/* Обратная сторона. Своя rotateY(180deg) чтобы при rotateY parent=180
              текст не был зеркальным. */}
          <Card
            className={`absolute inset-0 flex flex-col gap-4 overflow-hidden px-6 py-8 text-center ${CARD_SHADOW}`}
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
            }}
          >
            {/* Заливка-индикатор только на обратной стороне (где доступен свайп). */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: fillBg }}
            />
            <div className="relative flex flex-1 flex-col">{back}</div>
          </Card>
        </motion.div>

        {/* ✓/✗ overlay поверх всей карточки. */}
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
    </div>
  );
}

// ─── Лицевая сторона ─────────────────────────────────────────────────────────

function FrontFace({ question }: { question: PassiveRecallApiQuestion }) {
  const showMeaningIndex = question.totalMeanings > 1;
  return (
    <>
      {showMeaningIndex && (
        <div className="text-xs uppercase tracking-wide text-[var(--gray-11)]">
          {question.meaningIndex} из {question.totalMeanings}
        </div>
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="text-4xl font-bold text-[var(--gray-12)]">{question.word}</div>
        {question.example && (
          <div className="mt-4 text-base text-[var(--gray-11)]">
            {question.example.en}
          </div>
        )}
      </div>
      <div className="text-xs text-[var(--gray-10)]">Тапните, чтобы увидеть перевод</div>
    </>
  );
}

// ─── Обратная сторона ────────────────────────────────────────────────────────

function BackFace({ question }: { question: PassiveRecallApiQuestion }) {
  const showMeaningIndex = question.totalMeanings > 1;
  return (
    <>
      {showMeaningIndex && (
        <div className="text-xs uppercase tracking-wide text-[var(--gray-11)]">
          {question.meaningIndex} из {question.totalMeanings}
        </div>
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <div className="text-3xl font-bold text-[var(--gray-12)]">{question.translation}</div>
        {question.example && (
          <div className="mt-4 text-base text-[var(--gray-11)]">
            {question.example.ru}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--gray-10)]">
        <span>← не знал</span>
        <span>знал →</span>
      </div>
    </>
  );
}
