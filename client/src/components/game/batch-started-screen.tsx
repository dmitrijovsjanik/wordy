import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';

type BatchStartedScreenProps = {
  /** Размер стартовавшего батча. Используется в тексте «Ты отобрал N слов». */
  size: number;
  /** Закрытие экрана и переход к первому вопросу батча. Вызывается автоматически
   *  через autoAdvanceMs или по тапу. */
  onContinue: () => void;
  /** Через сколько мс автоматически закрыть экран. По спеке — 2-3 сек. */
  autoAdvanceMs?: number;
};

/**
 * Экран «Ты отобрал N слов» — появляется когда maybePromoteBatch стартует
 * новый цикл изучения (либо при свайпе 10-го «Изучаю», либо при ленивом
 * запуске в pickNext после доучивания предыдущего батча).
 *
 * Поведение: автопереход через autoAdvanceMs или по тапу в любое место.
 */
export function BatchStartedScreen({
  size,
  onContinue,
  autoAdvanceMs = 2500,
}: BatchStartedScreenProps) {
  const calledRef = useRef(false);
  const safeCall = () => {
    if (calledRef.current) return;
    calledRef.current = true;
    onContinue();
  };

  useEffect(() => {
    const id = setTimeout(safeCall, autoAdvanceMs);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceMs]);

  return (
    <button
      type="button"
      onClick={safeCall}
      className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center"
    >
      <div className="text-2xl font-semibold text-[var(--gray-12)]">
        Ты отобрал {size} {pluralWords(size)}
      </div>
      <p className="text-sm text-[var(--gray-11)]">Давай их изучим</p>
      <Button variant="default" className="mt-6" onClick={safeCall}>
        Продолжить
      </Button>
    </button>
  );
}

function pluralWords(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'слов';
  if (mod10 === 1) return 'слово';
  if (mod10 >= 2 && mod10 <= 4) return 'слова';
  return 'слов';
}
