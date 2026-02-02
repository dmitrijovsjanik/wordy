import { useState } from 'react';
import type { DictionaryLookupResult } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon, Tick01Icon } from '@hugeicons/core-free-icons';

const POS_LABELS: Record<string, string> = {
  noun: 'сущ.',
  verb: 'гл.',
  adj: 'прил.',
  adv: 'нареч.',
  phrase: 'фраза',
};

type DictionaryPreviewProps = {
  result: DictionaryLookupResult | null;
  isLoading: boolean;
  query: string;
  existingMeaningIds: Set<number>;
  onAdd: (meaningIds: number[], custom?: { wordText: string; translation: string }) => void;
};

export function DictionaryPreview({ result, isLoading, query, existingMeaningIds, onAdd }: DictionaryPreviewProps) {
  const [manualTranslation, setManualTranslation] = useState('');

  if (!query.trim()) return null;

  if (isLoading) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-40" />
      </Card>
    );
  }

  // Не найдено — fallback на ручной ввод
  if (!result || result.meanings.length === 0) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm text-[var(--gray-11)]">Не найдено в словаре</p>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm font-medium">{query}</span>
          <span className="text-[var(--gray-11)]">—</span>
          <Input
            placeholder="Перевод"
            value={manualTranslation}
            onChange={(e) => setManualTranslation(e.target.value)}
            className="h-10 flex-1 rounded-xl text-sm"
          />
        </div>
        <Button
          size="compact"
          disabled={!manualTranslation.trim()}
          onClick={() => {
            onAdd([], { wordText: query, translation: manualTranslation.trim() });
            setManualTranslation('');
          }}
          className="self-end"
        >
          <HugeiconsIcon icon={Add01Icon} size={16} />
          Добавить
        </Button>
      </Card>
    );
  }

  // Группируем meanings по partOfSpeech
  const groups = new Map<string, typeof result.meanings>();
  for (const m of result.meanings) {
    const key = m.partOfSpeech;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const meaningIds = result.meanings
    .map((m) => m.id)
    .filter((id): id is number => id !== null);

  return (
    <Card className="flex flex-col gap-3 p-4">
      {/* Заголовок: слово + транскрипция */}
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold">{result.word}</span>
        {result.transcription && (
          <span className="text-sm text-[var(--gray-11)]">/{result.transcription}/</span>
        )}
      </div>

      {/* Значения по частям речи */}
      <div className="flex flex-col gap-2">
        {[...groups.entries()].map(([pos, meanings]) => (
          <div key={pos} className="flex flex-col gap-1">
            <Badge variant="secondary" className="self-start text-[10px] uppercase">
              {POS_LABELS[pos] ?? pos}
            </Badge>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 pl-1">
              {meanings.map((m, i) => (
                <span key={i} className="text-sm">
                  {m.translation}
                  {i < meanings.length - 1 && ','}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Кнопка добавить */}
      {meaningIds.length > 0 && meaningIds.every((id) => existingMeaningIds.has(id)) ? (
        <Button size="compact" variant="secondary" disabled className="self-end">
          <HugeiconsIcon icon={Tick01Icon} size={16} />
          Уже добавлено
        </Button>
      ) : (
        <Button
          size="compact"
          onClick={() => onAdd(meaningIds)}
          className="self-end"
        >
          <HugeiconsIcon icon={Add01Icon} size={16} />
          Добавить
        </Button>
      )}
    </Card>
  );
}
