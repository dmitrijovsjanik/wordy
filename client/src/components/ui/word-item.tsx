import { Card } from '@/components/ui/card';

type WordItemProps = {
  word: string;
  translation: string;
};

export function WordItem({ word, translation }: WordItemProps) {
  return (
    <Card className="flex items-center justify-between p-4">
      <span className="text-sm font-medium">{word}</span>
      <span className="text-sm text-[var(--gray-11)]">{translation}</span>
    </Card>
  );
}
