import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type WordBadgeProps = {
  word: string;
  translations: string[];
  alternativeTranslations?: string[];
  srsStage?: number;
  className?: string;
};

export const WordBadge = memo(function WordBadge({ word, translations, className }: WordBadgeProps) {
  return (
    <Badge className={cn("h-auto min-h-8 gap-1.5 whitespace-nowrap", className)}>
      <span className="text-sm font-medium text-[var(--gray-12)]">{word}</span>
      <span className="text-sm text-[var(--gray-11)]">{translations[0]}</span>
    </Badge>
  );
});
