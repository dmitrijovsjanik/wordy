import { Card } from '@/components/ui/card';

type WordItemProps = {
  word: string;
  translations: string[];
};

export function WordItem({ word, translations }: WordItemProps) {
  return (
    <Card className="flex items-center justify-between gap-4 p-4">
      <span className="shrink-0 text-sm font-medium">{word}</span>
      <span className="text-right text-sm text-[var(--gray-11)]">
        {translations.join(', ')}
      </span>
    </Card>
  );
}
