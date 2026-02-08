import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTelegram } from '@/hooks/use-telegram';

type Pair = { meaningId: number; word: string; translation: string };

type MatchPairsProps = {
  pairs: Pair[];
  questionKey: string | number;
  disabled?: boolean;
  onComplete: (results: Array<{ meaningId: number; isCorrect: boolean }>) => void;
  onSkip?: () => void;
  showSkip?: boolean;
};

type Selection = { column: 'left' | 'right'; index: number } | null;

// Простой хеш строки → число для seed
function hashKey(key: string | number): number {
  const s = String(key);
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// Seeded PRNG (mulberry32) — детерминированный для одного и того же seed
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArraySeeded<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  const random = mulberry32(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function MatchPairs({ pairs, questionKey, disabled = false, onComplete, onSkip, showSkip = true }: MatchPairsProps) {
  const { hapticImpact, hapticNotification } = useTelegram();

  // Перемешиваем столбцы детерминированно (один seed на questionKey)
  const seed = useMemo(() => hashKey(questionKey), [questionKey]);
  const shuffledLeft = useMemo(() => shuffleArraySeeded(pairs.map((p, i) => ({ ...p, originalIndex: i })), seed), [questionKey, seed]);
  const shuffledRight = useMemo(() => shuffleArraySeeded(pairs.map((p, i) => ({ ...p, originalIndex: i })), seed + 1), [questionKey, seed]);

  const [selected, setSelected] = useState<Selection>(null);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [wrongAttempts, setWrongAttempts] = useState<Map<number, number>>(new Map());
  const [wrongFlash, setWrongFlash] = useState<{ leftIdx: number; rightIdx: number } | null>(null);
  const completedRef = useRef(false);

  // Сброс при смене вопроса
  useEffect(() => {
    setSelected(null);
    setMatched(new Set());
    setWrongAttempts(new Map());
    setWrongFlash(null);
    completedRef.current = false;
  }, [questionKey]);

  // Проверка завершения
  useEffect(() => {
    if (matched.size === pairs.length && pairs.length > 0 && !completedRef.current) {
      completedRef.current = true;
      const timer = setTimeout(() => {
        const results = pairs.map((p) => ({
          meaningId: p.meaningId,
          isCorrect: !wrongAttempts.has(p.meaningId) || wrongAttempts.get(p.meaningId) === 0,
        }));
        onComplete(results);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [matched.size, pairs, wrongAttempts, onComplete]);

  const handleTap = useCallback((column: 'left' | 'right', index: number) => {
    if (disabled || wrongFlash) return;

    // Определяем meaningId тапнутого элемента
    const item = column === 'left' ? shuffledLeft[index]! : shuffledRight[index]!;
    if (matched.has(item.meaningId)) return; // уже найдена

    hapticImpact('light');

    if (!selected) {
      // Первый тап — просто выделяем
      setSelected({ column, index });
      return;
    }

    if (selected.column === column) {
      // Тап в тот же столбик — переключаем выделение
      if (selected.index === index) {
        setSelected(null); // деселект
      } else {
        setSelected({ column, index });
      }
      return;
    }

    // Тап в другой столбик — проверяем пару
    const leftIdx = column === 'left' ? index : selected.index;
    const rightIdx = column === 'right' ? index : selected.index;
    const leftItem = shuffledLeft[leftIdx]!;
    const rightItem = shuffledRight[rightIdx]!;

    if (leftItem.meaningId === rightItem.meaningId) {
      // Правильная пара
      hapticNotification('success');
      setMatched((prev) => new Set([...prev, leftItem.meaningId]));
      setSelected(null);
    } else {
      // Неправильная пара — инкрементируем ошибки обоих
      hapticNotification('error');
      setWrongAttempts((prev) => {
        const next = new Map(prev);
        // Трекаем ошибки по meaningId того элемента, который был "целью" (первый выбранный)
        const selectedItem = selected.column === 'left' ? shuffledLeft[selected.index]! : shuffledRight[selected.index]!;
        next.set(selectedItem.meaningId, (next.get(selectedItem.meaningId) ?? 0) + 1);
        next.set(item.meaningId, (next.get(item.meaningId) ?? 0) + 1);
        return next;
      });
      setWrongFlash({ leftIdx, rightIdx });
      setSelected(null);

      // Убираем красную вспышку через 400мс
      setTimeout(() => setWrongFlash(null), 400);
    }
  }, [selected, matched, disabled, wrongFlash, shuffledLeft, shuffledRight, hapticImpact, hapticNotification]);

  const isCompleted = matched.size === pairs.length;

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-x-3 gap-y-2.5">
        {pairs.map((_, rowIdx) => {
          const leftItem = shuffledLeft[rowIdx]!;
          const rightItem = shuffledRight[rowIdx]!;

          const leftMatched = matched.has(leftItem.meaningId);
          const rightMatched = matched.has(rightItem.meaningId);

          const leftSelected = selected?.column === 'left' && selected.index === rowIdx;
          const rightSelected = selected?.column === 'right' && selected.index === rowIdx;

          const leftWrongFlash = wrongFlash?.leftIdx === rowIdx;
          const rightWrongFlash = wrongFlash?.rightIdx === rowIdx;

          return (
            <MatchPairRow
              key={`${questionKey}-row-${rowIdx}`}
              leftText={leftItem.word}
              rightText={rightItem.translation}
              leftMatched={leftMatched}
              rightMatched={rightMatched}
              leftSelected={leftSelected}
              rightSelected={rightSelected}
              leftWrongFlash={leftWrongFlash}
              rightWrongFlash={rightWrongFlash}
              disabled={disabled}
              onLeftTap={() => handleTap('left', rowIdx)}
              onRightTap={() => handleTap('right', rowIdx)}
            />
          );
        })}
      </div>

      {showSkip && onSkip && (
        <Button
          variant="link"
          size="sm"
          disabled={isCompleted || disabled}
          onClick={onSkip}
          className={cn(
            'mt-4 w-full',
            (isCompleted || disabled) && 'opacity-40',
          )}
        >
          Пропустить
        </Button>
      )}
    </>
  );
}

type MatchPairRowProps = {
  leftText: string;
  rightText: string;
  leftMatched: boolean;
  rightMatched: boolean;
  leftSelected: boolean;
  rightSelected: boolean;
  leftWrongFlash: boolean;
  rightWrongFlash: boolean;
  disabled: boolean;
  onLeftTap: () => void;
  onRightTap: () => void;
};

function MatchPairRow({
  leftText,
  rightText,
  leftMatched,
  rightMatched,
  leftSelected,
  rightSelected,
  leftWrongFlash,
  rightWrongFlash,
  disabled,
  onLeftTap,
  onRightTap,
}: MatchPairRowProps) {
  return (
    <>
      <Button
        variant={
          leftWrongFlash ? 'destructive' :
          leftMatched ? 'success' :
          'secondary'
        }
        disabled={leftMatched || disabled}
        onClick={onLeftTap}
        className={cn(
          'h-auto min-h-14 whitespace-normal px-3 py-2 text-center text-sm leading-tight transition-all',
          leftMatched && 'pointer-events-none',
          leftSelected && !leftMatched && 'ring-2 ring-[var(--brand-7)] bg-[var(--brand-3)] text-[var(--brand-12)]',
          leftWrongFlash && 'animate-shake',
        )}
      >
        {leftText}
      </Button>
      <Button
        variant={
          rightWrongFlash ? 'destructive' :
          rightMatched ? 'success' :
          'secondary'
        }
        disabled={rightMatched || disabled}
        onClick={onRightTap}
        className={cn(
          'h-auto min-h-14 whitespace-normal px-3 py-2 text-center text-sm leading-tight transition-all',
          rightMatched && 'pointer-events-none',
          rightSelected && !rightMatched && 'ring-2 ring-[var(--brand-7)] bg-[var(--brand-3)] text-[var(--brand-12)]',
          rightWrongFlash && 'animate-shake',
        )}
      >
        {rightText}
      </Button>
    </>
  );
}
