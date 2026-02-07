import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type WordBadgeProps = {
  word: string;
  translations: string[];
  alternativeTranslations?: string[];
  progress?: number; // 0.0-1.0, прогресс изучения слова
  className?: string;
  onClick?: () => void;
};

export const WordBadge = memo(function WordBadge({ word, translations, className, onClick }: WordBadgeProps) {
  return (
    <Badge
      className={cn(
        "h-auto min-h-8 gap-1.5 whitespace-nowrap",
        onClick && "cursor-pointer active:bg-[var(--gray-5)]",
        className
      )}
      onClick={onClick}
    >
      <span className="text-sm font-medium text-[var(--gray-12)]">{word}</span>
      <span className="text-sm text-[var(--gray-11)]">{translations[0]}</span>
    </Badge>
  );
});
