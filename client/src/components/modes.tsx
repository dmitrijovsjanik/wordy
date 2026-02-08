import { useNavigate } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sword01Icon, Tick01Icon } from '@hugeicons/core-free-icons';
import { useHomeStore, type QuestionGeneratorMode } from '@/stores/home-store';
import { cn } from '@/lib/utils';

const GENERATOR_MODES: { value: QuestionGeneratorMode; title: string; description: string }[] = [
  { value: 'auto', title: 'Авто', description: 'Случайная смена формата каждый вопрос' },
  { value: 'en-ru', title: 'EN → RU', description: 'Слово на английском — выбери перевод' },
  { value: 'ru-en', title: 'RU → EN', description: 'Слово на русском — выбери английский' },
  { value: 'spelling', title: 'Spelling', description: 'Выбери правильное написание слова' },
  { value: 'match-pairs', title: 'Пары', description: 'Соедините слово с переводом' },
];

export function Modes() {
  const navigate = useNavigate();
  const generatorMode = useHomeStore((s) => s.generatorMode);
  const setGeneratorMode = useHomeStore((s) => s.setGeneratorMode);

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-4">
      <h1 className="text-xl font-bold">Режимы</h1>

      {/* Дуэль */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--gray-11)]">Мультиплеер</h2>
        <div className="relative">
          <div
            className="pointer-events-none absolute -bottom-3 left-[10%] right-[10%] h-8 rounded-[50%] opacity-50 blur-xl"
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,100,20,0.6), rgba(255,60,0,0.3) 50%, transparent 80%)' }}
          />
          <button
            onClick={() => navigate('/duel/create')}
            className="duel-card relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-4 py-4 text-left text-white"
          >
            <svg className="absolute" width="0" height="0" aria-hidden="true">
              <defs>
                <filter id="duel-goo">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
                  <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
                  <feBlend in="SourceGraphic" in2="goo" />
                </filter>
              </defs>
            </svg>
            <div className="pointer-events-none absolute inset-[-10px] overflow-hidden duel-lava-wrap">
              <div className="duel-lava-goo">
                <div className="duel-blob duel-blob--1" />
                <div className="duel-blob duel-blob--2" />
                <div className="duel-blob duel-blob--3" />
                <div className="duel-blob duel-blob--4" />
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-2xl duel-glow-border" />
            <HugeiconsIcon strokeWidth={2} icon={Sword01Icon} size={22} className="relative z-10" />
            <div className="relative z-10 flex flex-1 flex-col">
              <h3 className="text-sm font-semibold">Дуэль</h3>
              <span className="text-xs opacity-80">Сразись с другом в реальном времени</span>
            </div>
            <span className="relative z-10 inline-flex shrink-0 items-center justify-center rounded-xl bg-white/20 px-3 py-1.5 text-xs font-medium text-white">
              Бросить вызов
            </span>
          </button>
        </div>
      </section>

      {/* Формат квиза */}
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
