import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useUserStore } from '@/stores/user-store';
import { useCollectionStore } from '@/stores/collection-store';
import { cn } from '@/lib/utils';

const LEVEL_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  a1: { bg: 'bg-[var(--cyan-4)]', text: 'text-[var(--cyan-11)]', ring: 'ring-[var(--cyan-7)]' },
  a2: { bg: 'bg-[var(--teal-4)]', text: 'text-[var(--teal-11)]', ring: 'ring-[var(--teal-7)]' },
  b1: { bg: 'bg-[var(--iris-4)]', text: 'text-[var(--iris-11)]', ring: 'ring-[var(--iris-7)]' },
  b2: { bg: 'bg-[var(--plum-4)]', text: 'text-[var(--plum-11)]', ring: 'ring-[var(--plum-7)]' },
};

const LEVEL_NAMES: Record<string, string> = {
  a1: 'Начинающий',
  a2: 'Элементарный',
  b1: 'Средний',
  b2: 'Продвинутый',
};

const CEFR_ORDER = ['a1', 'a2', 'b1', 'b2'] as const;

function getPrevLevelLabel(cefr: string): string | null {
  const idx = CEFR_ORDER.indexOf(cefr as typeof CEFR_ORDER[number]);
  if (idx <= 0) return null;
  const first = CEFR_ORDER[0].toUpperCase();
  const last = CEFR_ORDER[idx - 1].toUpperCase();
  return first === last ? first : `${first}–${last}`;
}

export function ResultStep() {
  const navigate = useNavigate();
  const resultCefr = useOnboardingStore((s) => s.resultCefr);
  const estimatedVocabulary = useOnboardingStore((s) => s.estimatedVocabulary);
  const percentile = useOnboardingStore((s) => s.percentile);
  const isFinalizing = useOnboardingStore((s) => s.isFinalizing);
  const [isNavigating, setIsNavigating] = useState(false);

  if (!resultCefr) return null;

  const style = LEVEL_STYLES[resultCefr] ?? LEVEL_STYLES.a1;
  const levelName = LEVEL_NAMES[resultCefr] ?? resultCefr.toUpperCase();
  const prevLabel = getPrevLevelLabel(resultCefr);
  const hasLowerLevels = prevLabel !== null;
  const isDisabled = isFinalizing || isNavigating;

  const handleFinalize = async (mode: 'all' | 'current-only') => {
    setIsNavigating(true);
    try {
      await useOnboardingStore.getState().finalize(mode);
      await useUserStore.getState().refreshProfile();
      await useCollectionStore.getState().fetchLibrary();
      // После плейсмента — свайп-калибровка (~10 слов вокруг определённого CEFR),
      // чтобы пользователь сразу попробовал основной механизм обзора и
      // мы получили начальный сигнал «знаю / учить» для подбора ленты обучения.
      useOnboardingStore.getState().setStep('calibration');
    } catch {
      setIsNavigating(false);
    }
  };

  // Кстати, navigate уже не нужен здесь — переход на главную происходит из calibration-step.
  void navigate;

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-8">
      {/* Center area */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <p className="text-sm text-[var(--gray-10)]">Твой уровень</p>

        {/* CEFR badge */}
        <div
          className={cn(
            'mt-3 flex h-20 w-20 items-center justify-center rounded-2xl ring-2',
            style.bg,
            style.text,
            style.ring,
          )}
        >
          <span className="text-2xl font-bold">{resultCefr.toUpperCase()}</span>
        </div>

        <p className="mt-3 text-xl font-semibold text-[var(--gray-12)]">
          {levelName}
        </p>

        {estimatedVocabulary !== null && (
          <p className="mt-1 text-sm text-[var(--gray-11)]">
            ~{estimatedVocabulary} слов
          </p>
        )}

        {percentile !== null && (
          <p className="mt-1 text-sm text-[var(--gray-11)]">
            Лучше, чем {percentile}% учеников
          </p>
        )}
      </div>

      {/* Button area */}
      <div className="mt-auto w-full pb-8">
        {hasLowerLevels ? (
          <>
            <Button
              className="w-full"
              disabled={isDisabled}
              onClick={() => handleFinalize('all')}
            >
              Добавить всё и начать
            </Button>

            <p className="mt-3 text-center text-xs leading-relaxed text-[var(--gray-10)]">
              Основные переводы слов {prevLabel} будут отмечены как выученные.
              Редкие значения знакомых слов всё равно будут появляться в квизах.
            </p>

            <Button
              variant="ghost"
              size="compact"
              className="mt-3 w-full"
              disabled={isDisabled}
              onClick={() => handleFinalize('current-only')}
            >
              Только {resultCefr.toUpperCase()}
            </Button>
          </>
        ) : (
          <Button
            className="w-full"
            disabled={isDisabled}
            onClick={() => handleFinalize('current-only')}
          >
            Начать обучение
          </Button>
        )}
      </div>
    </div>
  );
}
