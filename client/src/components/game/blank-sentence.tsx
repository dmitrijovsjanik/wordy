import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BlankState = 'empty' | 'correct' | 'wrong';

type BlankSentenceProps = {
  /** Text with ___ placeholders */
  text: string;
  /** Values to fill blanks (one per ___). If not provided, blank underline shown. */
  filledValues?: string[];
  /** State of the blank: empty (brand color), correct (green), wrong (red) */
  blankState?: BlankState;
  /** Font class override. Default: font-[Unbounded] font-bold with clamp sizing */
  className?: string;
};

const STATE_STYLES: Record<BlankState, string> = {
  empty: 'border-[var(--brand-9)] text-[var(--brand-9)]',
  correct: 'border-[var(--green-9)] text-[var(--green-11)]',
  wrong: 'border-[var(--red-9)] text-[var(--red-11)]',
};

/**
 * Renders text with ___ placeholders as styled underline blanks.
 * Used across cloze, articles, tenses, and collocations for consistent blank style.
 */
export function BlankSentence({ text, filledValues, blankState = 'empty', className }: BlankSentenceProps) {
  const parts = text.split(/(_{3,})/g);
  let blankIdx = 0;

  return (
    <span className={cn('text-[var(--gray-12)]', className)}>
      {parts.map((part, idx) => {
        if (/^_{3,}$/.test(part)) {
          const value = filledValues?.[blankIdx];
          blankIdx++;

          if (value) {
            return (
              <span
                key={idx}
                className={cn(
                  'mx-0.5 inline-block border-b-2 px-1 text-center font-bold',
                  STATE_STYLES[blankState],
                )}
              >
                {value}
              </span>
            );
          }

          return (
            <span
              key={idx}
              className={cn(
                'mx-0.5 inline-block min-w-[3rem] border-b-2 px-1 text-center',
                STATE_STYLES.empty,
              )}
            >
              {'\u00A0'}
            </span>
          );
        }

        return <span key={idx}>{part}</span>;
      })}
    </span>
  );
}

/**
 * Helper: split a multi-blank answer like "Will ... have read" into parts.
 */
export function splitAnswer(answer: string): string[] {
  return answer.split(' ... ');
}
