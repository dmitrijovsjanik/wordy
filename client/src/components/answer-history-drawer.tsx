import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import type { AnswerHistoryEntry } from '@/types/game';

type AnswerHistoryDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  history: AnswerHistoryEntry[];
  onClear: () => void;
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const TYPE_LABELS: Record<string, string> = {
  'multiple-choice': 'Выбор',
  'spelling': 'Написание',
  'cloze': 'Пропуск',
  'listening': 'Аудирование',
  'dictation': 'Диктант',
  'free-recall': 'Перевод',
  'match-pairs': 'Пары',
};

export function AnswerHistoryDrawer({
  open,
  onOpenChange,
  history,
  onClear,
}: AnswerHistoryDrawerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 4);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(updateScrollState);
  }, [open, history.length, updateScrollState]);

  const correctCount = history.filter((e) => e.isCorrect).length;
  const totalCount = history.length;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader>
          <DrawerTitle className="text-center">Ответы за сегодня</DrawerTitle>
          {totalCount > 0 && (
            <DrawerDescription className="text-center">
              {correctCount}/{totalCount} правильно ({totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0}%)
            </DrawerDescription>
          )}
        </DrawerHeader>

        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="min-h-[200px] flex-1 overflow-y-auto px-4 py-2"
          style={{
            maskImage: `linear-gradient(to bottom, ${canScrollUp ? 'transparent' : 'black'} 0%, black ${canScrollUp ? '24px' : '0px'}, black calc(100% - ${canScrollDown ? '24px' : '0px'}), ${canScrollDown ? 'transparent' : 'black'} 100%)`,
            WebkitMaskImage: `linear-gradient(to bottom, ${canScrollUp ? 'transparent' : 'black'} 0%, black ${canScrollUp ? '24px' : '0px'}, black calc(100% - ${canScrollDown ? '24px' : '0px'}), ${canScrollDown ? 'transparent' : 'black'} 100%)`,
          }}
        >
          {totalCount === 0 ? (
            <div className="flex h-[200px] items-center justify-center">
              <span className="text-sm text-[var(--gray-9)]">Пока нет ответов</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {history.map((entry, idx) => (
                <div
                  key={`${entry.timestamp}-${idx}`}
                  className="flex items-start gap-3 rounded-xl bg-[var(--gray-2)] px-3 py-2.5"
                >
                  {/* Статус */}
                  <div className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    entry.isCorrect
                      ? 'bg-[var(--green-3)] text-[var(--green-11)]'
                      : 'bg-[var(--red-3)] text-[var(--red-11)]',
                  )}>
                    {entry.isCorrect ? '✓' : '✗'}
                  </div>

                  {/* Контент */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--gray-12)]">
                        {entry.question}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--gray-9)]">
                        {formatTime(entry.timestamp)}
                      </span>
                    </div>

                    {entry.isCorrect ? (
                      <p className="mt-0.5 text-xs text-[var(--green-11)]">
                        {entry.userAnswer}
                      </p>
                    ) : (
                      <div className="mt-0.5 flex flex-col gap-0.5">
                        {entry.userAnswer && entry.userAnswer !== '—' && (
                          <p className="text-xs text-[var(--red-11)] line-through">
                            {entry.userAnswer}
                          </p>
                        )}
                        <p className="text-xs text-[var(--green-11)]">
                          {entry.correctAnswer}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Тип вопроса */}
                  <span className="mt-0.5 shrink-0 rounded bg-[var(--gray-3)] px-1.5 py-0.5 text-[10px] text-[var(--gray-10)]">
                    {TYPE_LABELS[entry.type] ?? entry.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalCount > 0 && (
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={onClear}
              className="w-full text-center text-xs text-[var(--gray-9)] hover:text-[var(--gray-11)] transition-colors"
            >
              Очистить историю
            </button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
