import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useUserStore } from '@/stores/user-store';
import type { CefrLevel } from '@/types/api';

const LEVEL_STYLES = {
  a1: { bg: 'bg-[var(--cyan-3)]', border: 'border-[var(--cyan-7)]', iconBg: 'bg-[var(--cyan-6)]', text: 'text-[var(--cyan-11)]' },
  a2: { bg: 'bg-[var(--teal-3)]', border: 'border-[var(--teal-7)]', iconBg: 'bg-[var(--teal-6)]', text: 'text-[var(--teal-11)]' },
  b1: { bg: 'bg-[var(--iris-3)]', border: 'border-[var(--iris-7)]', iconBg: 'bg-[var(--iris-6)]', text: 'text-[var(--iris-11)]' },
  b2: { bg: 'bg-[var(--plum-3)]', border: 'border-[var(--plum-7)]', iconBg: 'bg-[var(--plum-6)]', text: 'text-[var(--plum-11)]' },
};

const LEVELS = [
  { key: 'a1' as const, title: 'Начинающий', examples: 'cat, book, table, hello' },
  { key: 'a2' as const, title: 'Элементарный', examples: 'weather, important, happened' },
  { key: 'b1' as const, title: 'Средний', examples: 'appropriate, circumstances, persuade' },
  { key: 'b2' as const, title: 'Продвинутый', examples: 'subsequent, ambiguous, reluctant' },
];

export function SelfAssessmentStep() {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState<CefrLevel | null>(null);
  const [isSkipping, setIsSkipping] = useState(false);

  const handleSelectLevel = (level: CefrLevel) => {
    setSelectedLevel(level);
    useOnboardingStore.getState().setSelfAssessment(level);
  };

  const handleStartQuiz = () => {
    useOnboardingStore.getState().startQuiz();
  };

  const handleSkip = async () => {
    setIsSkipping(true);
    try {
      await useOnboardingStore.getState().skipWithLevel(selectedLevel ?? 'a1');
      await useUserStore.getState().refreshProfile();
      navigate('/', { replace: true });
    } finally {
      setIsSkipping(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <h1 className="text-xl font-semibold text-[var(--gray-12)] px-4 pt-6">
        Какой у тебя уровень?
      </h1>
      <p className="text-sm text-[var(--gray-11)] px-4 mt-1 mb-4">
        Выбери ближайший — мы уточним позже
      </p>

      <div className="flex flex-col gap-2.5 px-4">
        {LEVELS.map((level) => {
          const styles = LEVEL_STYLES[level.key];
          const isSelected = selectedLevel === level.key;

          return (
            <button
              key={level.key}
              type="button"
              className={cn(
                'flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors w-full',
                isSelected
                  ? cn(styles.bg, styles.border)
                  : 'border-transparent bg-[var(--gray-2)] active:bg-[var(--gray-3)]',
              )}
              onClick={() => handleSelectLevel(level.key)}
            >
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white',
                  styles.iconBg,
                )}
              >
                {level.key.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className={cn('text-sm font-medium', isSelected ? styles.text : 'text-[var(--gray-12)]')}>
                  {level.title}
                </div>
                <div className="text-xs text-[var(--gray-10)] mt-0.5 truncate">
                  {level.examples}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-auto w-full px-4 pb-8 pt-4 flex flex-col items-center gap-2">
        <Button
          className="w-full"
          disabled={!selectedLevel}
          onClick={handleStartQuiz}
        >
          Начать разминку
        </Button>
        <Button
          variant="ghost"
          size="compact"
          className="text-[var(--gray-10)]"
          disabled={isSkipping}
          onClick={handleSkip}
        >
          {isSkipping ? 'Загрузка...' : 'Пропустить'}
        </Button>
      </div>
    </div>
  );
}
