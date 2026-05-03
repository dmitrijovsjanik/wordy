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
import type { PassiveRecallApiQuestion, WordMeaningInfo } from '@/types/api';

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
        {/* Лицо: слово + список английских примеров (по одному на каждое
            значение) + индикатор «N значений». На обратной — те же
            предложения с переводами рядом. */}
        <FrontFace
          word={question.word}
          meanings={question.meanings ?? [{
            meaningId: question.meaningId,
            translation: question.translation,
            example: question.example,
            partOfSpeech: 'noun',
          }]}
        />

        {/* Обратная: список всех значений + ripple-заливка для свайпа */}
        <BackFace
          fillBg={fillBg}
          showFill={dragEnabled}
          meanings={question.meanings ?? [{
            meaningId: question.meaningId,
            translation: question.translation,
            example: question.example,
            partOfSpeech: 'noun',
          }]}
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

// ─── Front: слово + список английских примеров + индикатор «N значений» ────

type FrontFaceProps = {
  word: string;
  meanings: WordMeaningInfo[];
};

function FrontFace({ word, meanings }: FrontFaceProps) {
  const meaningCount = meanings.length;
  // Предложения с примерами (en) — фильтруем пустые. Каждый en будет иметь
  // соответствующий ru перевод на обратной стороне в том же порядке.
  const examplesEn = meanings
    .map((m) => m.example?.en ?? null)
    .filter((s): s is string => s !== null);

  return (
    <Card
      className={`absolute inset-0 flex flex-col gap-3 overflow-hidden px-6 py-8 ${CARD_SHADOW}`}
      style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
    >
      {/* Слово сверху по центру + индикатор «N значений». */}
      <div className="flex flex-col items-center gap-1 text-center">
        {meaningCount > 1 && (
          <div className="text-xs uppercase tracking-wide text-[var(--gray-11)]">
            {meaningCount} {pluralizeMeanings(meaningCount)}
          </div>
        )}
        <div className="text-3xl font-bold">{word}</div>
      </div>

      {/* Список английских примеров — по одному на значение. */}
      {examplesEn.length > 0 && (
        <div className="flex-1 overflow-y-auto border-t border-[var(--gray-5)] pt-3">
          {examplesEn.length === 1 ? (
            <div className="text-sm text-[var(--gray-12)] text-left">{examplesEn[0]}</div>
          ) : (
            <div className="flex flex-col gap-2 text-left">
              {examplesEn.map((s, idx) => (
                <div key={idx} className="flex items-baseline gap-2">
                  <span className="text-xs text-[var(--gray-10)]">{idx + 1}.</span>
                  <span className="text-sm text-[var(--gray-12)]">{s}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Back: список всех значений ──────────────────────────────────────────────

type BackFaceProps = {
  fillBg: import('framer-motion').MotionValue<string>;
  showFill: boolean;
  meanings: WordMeaningInfo[];
};

function BackFace({ fillBg, showFill, meanings }: BackFaceProps) {
  return (
    <Card
      className={`absolute inset-0 flex flex-col gap-3 overflow-hidden px-6 py-8 ${CARD_SHADOW}`}
      style={{
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        transform: 'rotateY(180deg)',
      }}
    >
      {showFill && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: fillBg }}
        />
      )}

      <div className="relative flex-1 overflow-y-auto">
        {meanings.length === 1 ? (
          // Один meaning — крупное центрированное отображение перевода,
          // снизу — пример с обеими версиями (en на лицевой повторяется
          // здесь же, чтобы пользователь видел соответствие).
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <div className="text-3xl font-bold">{meanings[0]!.translation}</div>
            {meanings[0]!.example && (
              <div className="mt-2 border-t border-[var(--gray-5)] pt-3 text-left">
                <div className="text-sm text-[var(--gray-12)]">{meanings[0]!.example.en}</div>
                <div className="mt-0.5 text-sm text-[var(--gray-11)]">{meanings[0]!.example.ru}</div>
              </div>
            )}
          </div>
        ) : (
          // Список значений: для каждого — перевод + билингвальный пример.
          // Английский повторяется с лицевой стороны (для первого meaning),
          // плюс свой пример у каждого следующего значения.
          <div className="flex flex-col gap-3 text-left">
            {meanings.map((m, idx) => (
              <div
                key={m.meaningId}
                className={idx > 0 ? 'border-t border-[var(--gray-5)] pt-3' : ''}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-[var(--gray-10)]">{idx + 1}.</span>
                  <span className="text-base font-semibold">{m.translation}</span>
                </div>
                {m.example && (
                  <div className="ml-5 mt-1">
                    <div className="text-xs text-[var(--gray-12)]">{m.example.en}</div>
                    <div className="text-xs text-[var(--gray-10)]">{m.example.ru}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function pluralizeMeanings(n: number): string {
  const last2 = n % 100;
  const lastDigit = n % 10;
  if (last2 >= 11 && last2 <= 14) return 'значений';
  if (lastDigit === 1) return 'значение';
  if (lastDigit >= 2 && lastDigit <= 4) return 'значения';
  return 'значений';
}
