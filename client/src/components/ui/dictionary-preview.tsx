import type { DictionaryLookupResult } from '@/types/api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

const POS_LABELS: Record<string, string> = {
  noun: 'сущ.',
  verb: 'гл.',
  adj: 'прил.',
  adv: 'нареч.',
  phrase: 'фраза',
};

// Хелпер для получения meaningIds из результата
export function getMeaningIds(result: DictionaryLookupResult | null): number[] {
  if (!result) return [];
  return result.meanings
    .map((m) => m.id)
    .filter((id): id is number => id !== null);
}

// Хелпер для проверки "уже добавлено"
export function isAlreadyAdded(result: DictionaryLookupResult | null, existingMeaningIds: Set<number>): boolean {
  const ids = getMeaningIds(result);
  return ids.length > 0 && ids.every((id) => existingMeaningIds.has(id));
}

type DictionaryPreviewProps = {
  result: DictionaryLookupResult | null;
  isLoading: boolean;
  query: string;
  existingMeaningIds: Set<number>;
  manualTranslation: string;
  onManualTranslationChange: (value: string) => void;
};

export function DictionaryPreview({
  result,
  isLoading,
  query,
  existingMeaningIds: _existingMeaningIds,
  manualTranslation,
  onManualTranslationChange,
}: DictionaryPreviewProps) {
  const isVisible = !!query.trim();

  // Группируем meanings по partOfSpeech
  const groups = new Map<string, NonNullable<typeof result>['meanings']>();
  if (result) {
    for (const m of result.meanings) {
      const key = m.partOfSpeech;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(m);
    }
  }

  // Скелетон при загрузке
  if (isLoading) {
    return (
      <Card className="flex flex-col gap-3 p-4 transition-opacity duration-200">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-40" />
      </Card>
    );
  }

  // Не найдено — fallback на ручной ввод
  if (isVisible && (!result || result.meanings.length === 0)) {
    return (
      <Card className="flex flex-col gap-3 p-4 animate-in fade-in duration-200">
        <p className="text-sm text-[var(--gray-11)]">Не найдено в словаре</p>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-sm font-medium">{query}</span>
          <span className="text-[var(--gray-11)]">—</span>
          <Input
            placeholder="Перевод"
            value={manualTranslation}
            onChange={(e) => onManualTranslationChange(e.target.value)}
            className="h-10 flex-1 rounded-xl text-sm"
          />
        </div>
      </Card>
    );
  }

  // Нет запроса — не показываем
  if (!isVisible || !result) return null;

  return (
    <Card className="flex flex-col gap-3 p-4 animate-in fade-in duration-200">
      {/* Заголовок: слово + транскрипция */}
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold">{result.word}</span>
        {result.transcription && (
          <span className="text-sm text-[var(--gray-11)]">/{result.transcription}/</span>
        )}
      </div>

      {/* Значения по частям речи */}
      <div className="flex flex-col gap-2">
        {[...groups.entries()].map(([pos, meanings]) => {
          // Собираем все переводы этой части речи
          const translations = meanings.map((m) => m.translation);
          // Собираем все синонимы (без дубликатов)
          const allSynonyms = [...new Set(meanings.flatMap((m) => m.synonyms))];
          // Собираем все примеры (без дубликатов по тексту)
          const allExamples = meanings
            .flatMap((m) => m.examples)
            .filter((ex, i, arr) => arr.findIndex((e) => e.text === ex.text) === i)
            .slice(0, 2);

          return (
            <div key={pos} className="flex flex-col gap-1">
              {/* Часть речи */}
              <Badge variant="secondary" className="self-start text-[10px] uppercase">
                {POS_LABELS[pos] ?? pos}
              </Badge>
              {/* Переводы через запятую + синонимы */}
              <div className="flex flex-wrap items-baseline gap-x-1 pl-1">
                <span className="text-sm font-medium">{translations.join(', ')}</span>
                {allSynonyms.length > 0 && (
                  <span className="text-xs text-[var(--gray-10)]">
                    ({allSynonyms.slice(0, 3).join(', ')})
                  </span>
                )}
              </div>
              {/* Примеры */}
              {allExamples.length > 0 && (
                <div className="flex flex-col gap-0.5 pl-1">
                  {allExamples.map((ex, j) => (
                    <p key={j} className="text-xs text-[var(--gray-11)]">
                      <span className="italic">{ex.text}</span>
                      {ex.translation && (
                        <>
                          <span> — </span>
                          <span>{ex.translation}</span>
                        </>
                      )}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </Card>
  );
}
