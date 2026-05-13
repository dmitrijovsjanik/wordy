import { Button } from '@/components/ui/button';
import { LearningCard, type LearningCardMeaning } from '@/components/game/learning-card';
import { cn } from '@/lib/utils';
import type { PoolCardApiQuestion, PoolSwipeAction, WordMeaningInfo } from '@/types/api';

type PoolCardProps = {
  question: PoolCardApiQuestion;
  disabled?: boolean;
  /** Знаю / Изучаю / Отложить. */
  onSwipe: (action: PoolSwipeAction) => void;
};

/**
 * L0 pool-карточка в основном потоке обучения. Использует общий <LearningCard>.
 *
 * UX:
 *   - Знаю   (зелёная, primary): слово улетает в L3 stage=0 (1 день).
 *   - Изучаю (красная, primary): слово идёт в L1 passive, обычная лестница.
 *   - Отложить (tertiary): pool_snoozed на 7±2 дней.
 */
export function PoolCard({ question, disabled = false, onSwipe }: PoolCardProps) {
  const meanings: LearningCardMeaning[] = question.meanings.map(toLearningMeaning);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <LearningCard
          prompt="Знакомо ли вам это слово?"
          word={question.word}
          transcription={question.transcription ?? null}
          meanings={meanings}
          revealed
          audioWord={question.word}
        />
      </div>

      {/* Footer */}
      <div className="flex shrink-0 flex-col gap-3 px-8 py-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => !disabled && onSwipe('learn')}
            disabled={disabled}
            className={cn(
              'flex flex-1 items-center justify-center rounded-full bg-[var(--red-9)] px-4 py-4 text-sm font-medium text-white',
              'active:bg-[var(--red-10)] disabled:opacity-40',
            )}
          >
            Изучаю
          </button>
          <button
            type="button"
            onClick={() => !disabled && onSwipe('know')}
            disabled={disabled}
            className={cn(
              'flex flex-1 items-center justify-center rounded-full bg-[var(--green-9)] px-4 py-4 text-sm font-medium text-white',
              'active:bg-[var(--green-10)] disabled:opacity-40',
            )}
          >
            Знаю
          </button>
        </div>
        <Button
          variant="ghost"
          disabled={disabled}
          onClick={() => onSwipe('snooze')}
          className="text-xs text-[var(--gray-11)]"
        >
          Отложить
        </Button>
      </div>
    </div>
  );
}

function toLearningMeaning(m: WordMeaningInfo): LearningCardMeaning {
  return {
    meaningId: m.meaningId,
    translation: m.translation,
    partOfSpeech: m.partOfSpeech,
    example: m.example ?? null,
  };
}
