import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick01Icon } from '@hugeicons/core-free-icons';
import { BackButton } from '@/components/ui/back-button';
import { useUnifiedGameStore, type QuestionGeneratorMode } from '@/stores/unified-game-store';
import { cn } from '@/lib/utils';

const GENERATOR_MODES: { value: QuestionGeneratorMode; title: string; description: string }[] = [
  { value: 'auto', title: 'Авто', description: 'Случайная смена формата каждый вопрос' },
  { value: 'en-ru', title: 'EN → RU', description: 'Слово на английском — выбери перевод' },
  { value: 'ru-en', title: 'RU → EN', description: 'Слово на русском — выбери английский' },
  { value: 'match-pairs', title: 'Пары', description: 'Соедините слово с переводом' },
];

/**
 * Quiz (legacy) — страница-заглушка.
 *
 * Точка входа — карточка «Квиз (legacy)» в блоке «Другое» на дашборде.
 * Здесь оставлены переключатели формата (модификаторы legacy-квиза). Сам
 * legacy-квиз как рабочий поток будет проработан после пилота.
 */
export function Modes() {
  const navigate = useNavigate();
  const generatorMode = useUnifiedGameStore((s) => s.generatorMode);
  const setGeneratorMode = useUnifiedGameStore((s) => s.setGeneratorMode);

  return (
    <div className="flex flex-col gap-5 px-4 pt-4 pb-4">
      <BackButton onClick={() => navigate('/')} variant="ghost" />

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Квиз (legacy)</h1>
        <p className="text-sm text-[var(--gray-11)]">
          Старый формат квиза. Будет проработан после пилота.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--gray-11)]">Формат квиза</h2>
        <div className="flex flex-col gap-2">
          {GENERATOR_MODES.map((mode) => {
            const isActive = generatorMode === mode.value;
            return (
              <button
                key={mode.value}
                onClick={() => setGeneratorMode(mode.value)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-2xl bg-[var(--gray-2)] px-4 py-3 text-left transition-colors active:bg-[var(--gray-3)]',
                  isActive && 'ring-2 ring-[var(--accent-9)]',
                )}
              >
                <div className="flex flex-1 flex-col">
                  <span className="text-sm font-semibold">{mode.title}</span>
                  <span className="text-xs text-[var(--gray-11)]">{mode.description}</span>
                </div>
                {isActive && (
                  <HugeiconsIcon
                    icon={Tick01Icon}
                    size={18}
                    className="shrink-0 text-[var(--accent-9)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
