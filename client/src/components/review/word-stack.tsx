import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, useSpring, AnimatePresence, animate, type PanInfo } from 'framer-motion';
import { Card } from '@/components/ui/card';
import type { ReviewFeedWord } from '@/types/api';

type Action = 'known' | 'unknown' | 'snooze';

type WordStackProps = {
  word: ReviewFeedWord;
  meaningIndex: number;
  onSwipe: (action: Action) => void;
  onUndo: () => void;
};

// Пороги по motion value (= позиции карты, не пути пальца). С dragElastic=0.6
// палец проходит ~1.66× больше, чем motion value, поэтому x=70 ≈ ~117px пальцем.
const SWIPE_THRESHOLD_X = 70;
const SWIPE_THRESHOLD_Y = 90;
const FLY_AWAY_DISTANCE = 800;
const FLY_AWAY_DURATION = 0.22;

const CARD_SHADOW = 'shadow-[0_10px_30px_-5px_rgba(0,0,0,0.18)]';

/**
 * Стопка значений одного слова. Под верхней карточкой — только meaning'и
 * того же слова, без чужих слов. Карусель смены слова делается на уровне
 * ReviewPage; сюда пробрасывается только текущее слово.
 *
 * При свайпе верхняя карта улетает в направлении жеста независимо от
 * вертикальной карусели. Цвет карты подкрашивается зелёным/красным
 * радиальным градиентом из правого/левого края при горизонтальном свайпе.
 */
export function WordStack({ word, meaningIndex, onSwipe, onUndo }: WordStackProps) {
  const meaning = word.meanings[meaningIndex];
  if (!meaning) return null;

  const totalMeanings = word.meanings.length;
  const remainingBehind = word.meanings.slice(meaningIndex + 1, meaningIndex + 3);

  return (
    <div className="relative h-[60vh] w-full">
      {/* Фантомы — только meaning'и ТОГО ЖЕ слова. У каждого свой
          inset-overlay сверху для эффекта объёма (тень от карты выше). */}
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
          <Card className={`relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-8 text-center ${CARD_SHADOW}`}>
            <div className="text-2xl font-bold opacity-70">{word.word}</div>
            {/* Затемняющий overlay сверху — имитация падающей тени от карты выше. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/20 via-black/5 to-transparent"
            />
          </Card>
        </div>
      ))}

      <AnimatePresence mode="popLayout" initial={false}>
        <TopCard
          key={`top-${word.wordId}-${meaning.meaningId}`}
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

  // Точка касания на карте в процентах (0..100). Обновляется на pointer down,
  // чтобы radial-gradient рос из именно того места, где юзер положил палец.
  const originX = useMotionValue(50);
  const originY = useMotionValue(50);

  // Бистабильный флаг «карта в зоне дропа» (|x| >= порог). 0 или 1.
  // Через useSpring переход 0↔1 сглаживается в ~100мс — резкого скачка не видно,
  // но и долго смешиваться с partial-значением не будет.
  const inDropZone = useMotionValue(0);
  const dropZoneSpring = useSpring(inDropZone, { stiffness: 380, damping: 32 });

  useEffect(() => {
    const unsub = x.on('change', (val) => {
      inDropZone.set(Math.abs(val) >= SWIPE_THRESHOLD_X ? 1 : 0);
    });
    return unsub;
  }, [x, inDropZone]);

  // Заливка ripple-стиль: круг расходится из точки касания.
  //   До порога:   радиус = (|x| / порог) * 75%   — линейно до ~75%.
  //   На пороге:   через spring перетекает к 220% — карта целиком окрашена.
  //   После возврата за порог: симметрично обратно.
  const fillBg = useTransform([x, originX, originY, dropZoneSpring], (latest) => {
    const xv = latest[0] as number;
    const ox = latest[1] as number;
    const oy = latest[2] as number;
    const lock = latest[3] as number; // 0..1, плавно через spring
    if (xv === 0 && lock < 0.01) {
      return 'radial-gradient(circle at 50% 50%, transparent 0%, transparent 100%)';
    }
    const k = Math.min(1, Math.abs(xv) / SWIPE_THRESHOLD_X);
    const partialRadius = k * 75;     // 0..75%
    const fullRadius = 220;            // полное покрытие на пороге
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
    // Важно: смотрим именно на motion value `x`/`y` (= реальная позиция карты),
    // а не на info.offset (= путь пальца). С `dragElastic` карта движется
    // медленнее пальца, и offset/motion-value расходятся. Цветовая заливка
    // тоже считается по motion value, поэтому критерии триггера и заливки
    // должны смотреть на одно и то же — иначе карта улетает с partial-цветом.
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
    // Не достигли порога — framer-motion вернёт через dragSnapToOrigin.
  };

  return (
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
      <Card className={`relative flex flex-1 flex-col gap-4 overflow-hidden px-6 py-8 text-center ${CARD_SHADOW}`}>
        {/* Ripple-заливка из точки касания. Цвет/радиус зависят от drag.x. */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: fillBg }}
        />

        <div className="relative flex flex-1 flex-col items-center justify-center gap-2">
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
          <div className="relative border-t border-[var(--gray-5)] pt-3 text-left">
            <div className="text-sm">{example.en}</div>
            <div className="text-sm text-[var(--gray-11)]">{example.ru}</div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
