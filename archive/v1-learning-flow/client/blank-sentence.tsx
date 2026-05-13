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
            // \u0415\u0441\u043B\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0435\u0441\u0442\u044C, \u043D\u043E blankState=empty \u2014 \u0440\u0435\u043D\u0434\u0435\u0440\u0438\u043C \u0442\u0435\u043A\u0441\u0442
            // \u043F\u0440\u043E\u0437\u0440\u0430\u0447\u043D\u044B\u043C. \u0422\u0430\u043A \u043F\u0440\u043E\u043F\u0443\u0441\u043A \u0440\u0435\u0437\u0435\u0440\u0432\u0438\u0440\u0443\u0435\u0442 \u0440\u043E\u0432\u043D\u043E \u0442\u0443 \u0436\u0435 \u0448\u0438\u0440\u0438\u043D\u0443, \u0447\u0442\u043E
            // \u0437\u0430\u0439\u043C\u0451\u0442 \u043D\u0430\u0441\u0442\u043E\u044F\u0449\u0435\u0435 \u0441\u043B\u043E\u0432\u043E \u043F\u043E\u0441\u043B\u0435 \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438, \u0438 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043D\u0435
            // \u043F\u0435\u0440\u0435\u0432\u0435\u0440\u0441\u0442\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043F\u0440\u0438 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0438.
            const isEmpty = blankState === 'empty';
            return (
              <span
                key={idx}
                className={cn(
                  'mx-0.5 inline-block border-b-2 px-1 text-center font-bold',
                  isEmpty
                    ? 'border-[var(--brand-9)] text-transparent'
                    : STATE_STYLES[blankState],
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
