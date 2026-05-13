import { Button } from '@/components/ui/button';

type DailyLimitScreenProps = {
  /** Сколько слов выучено сегодня. Для текста «Ты изучил N слов». */
  count: number;
  /** Юзер хочет вернуться к разметке коллекции (обзор). */
  onMarkMore: () => void;
  /** Юзер хочет выйти на главную. */
  onHome: () => void;
};

/**
 * Экран «Ты изучил N слов» — появляется когда дневной лимит изучения
 * достигнут (10 переходов active → review). Требует выбора CTA.
 *
 * Поведение: НЕ автопереход. Юзер сам решает «Размечать дальше» или
 * «На главную».
 */
export function DailyLimitScreen({ count, onMarkMore, onHome }: DailyLimitScreenProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="text-2xl font-semibold text-[var(--gray-12)]">
        Ты изучил {count} {pluralWords(count)}
      </div>
      <p className="text-sm text-[var(--gray-11)]">
        Возвращайся завтра, чтобы закрепить их. Можешь продолжить разметку коллекции.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Button variant="default" onClick={onMarkMore}>
          Размечать дальше
        </Button>
        <Button variant="secondary" onClick={onHome}>
          На главную
        </Button>
      </div>
    </div>
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
