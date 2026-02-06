import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export type QuestionGeneratorMode =
  | 'auto'          // Случайное направление, multiple-choice
  | 'en-ru'         // EN → RU, multiple-choice
  | 'ru-en'         // RU → EN, multiple-choice
  | 'spelling';     // Spelling (всегда ru-en)

type DirectionSelectProps = {
  value: QuestionGeneratorMode;
  onChange: (value: QuestionGeneratorMode) => void;
};

const GENERATOR_OPTIONS: { value: QuestionGeneratorMode; label: string }[] = [
  { value: 'auto', label: 'Авто' },
  { value: 'en-ru', label: 'EN → RU' },
  { value: 'ru-en', label: 'RU → EN' },
  { value: 'spelling', label: 'Spelling' },
];

export function DirectionSelect({ value, onChange }: DirectionSelectProps) {
  const currentLabel = GENERATOR_OPTIONS.find((o) => o.value === value)?.label ?? 'Авто';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[var(--gray-3)] px-2.5 text-sm text-[var(--gray-11)] active:bg-[var(--gray-4)]"
        >
          {currentLabel}
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {GENERATOR_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => onChange(option.value)}
            className={value === option.value ? 'bg-[var(--gray-4)]' : ''}
          >
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
