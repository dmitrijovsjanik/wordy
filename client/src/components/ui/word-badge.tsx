import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type WordBadgeProps = {
  word: string;
  translations: string[];
  className?: string;
};

export function WordBadge({ word, translations, className }: WordBadgeProps) {
  return (
    <Badge className={cn("h-8 gap-1.5", className)}>
      <span className="text-sm font-medium text-[var(--gray-12)]">{word}</span>
      <span className="text-sm text-[var(--gray-11)]">{translations.join(', ')}</span>
    </Badge>
  );
}
