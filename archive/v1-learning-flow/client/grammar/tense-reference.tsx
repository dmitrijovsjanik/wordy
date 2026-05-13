import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, BookOpen02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  TENSE_REFERENCE_DATA,
  type TenseReferenceItem,
  type FormulaPart,
  type FormulaPartRole,
  type ExampleSentence,
  type TenseGroup,
} from './tense-reference-data';

// ─── Color Mapping ────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<FormulaPartRole, string> = {
  subject: 'rounded px-1.5 py-0.5 font-semibold bg-[var(--blue-3)] text-[var(--blue-11)]',
  auxiliary: 'rounded px-1.5 py-0.5 font-semibold bg-[var(--violet-3)] text-[var(--violet-11)]',
  'main-verb': 'rounded px-1.5 py-0.5 font-semibold bg-[var(--green-3)] text-[var(--green-11)]',
  ending: 'rounded px-1.5 py-0.5 font-semibold bg-[var(--amber-3)] text-[var(--amber-11)]',
  connector: 'text-[var(--gray-9)]',
  punctuation: 'text-[var(--gray-9)]',
  plain: '',
};

// Inline example styles — no background, just colored text for readability
const EXAMPLE_STYLES: Record<FormulaPartRole, string> = {
  subject: 'font-medium text-[var(--blue-11)]',
  auxiliary: 'font-medium text-[var(--violet-11)]',
  'main-verb': 'font-semibold text-[var(--green-11)]',
  ending: 'font-semibold text-[var(--amber-11)]',
  connector: '',
  punctuation: '',
  plain: 'text-[var(--gray-12)]',
};

const LEGEND_ITEMS = [
  { label: 'S — подлежащее', className: 'bg-[var(--blue-3)] text-[var(--blue-11)]' },
  { label: 'Вспомогательный', className: 'bg-[var(--violet-3)] text-[var(--violet-11)]' },
  { label: 'V — глагол', className: 'bg-[var(--green-3)] text-[var(--green-11)]' },
  { label: 'Окончание', className: 'bg-[var(--amber-3)] text-[var(--amber-11)]' },
];

type GroupFilter = 'all' | TenseGroup;

const GROUP_LABELS: { value: GroupFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'present', label: 'Present' },
  { value: 'past', label: 'Past' },
  { value: 'future', label: 'Future' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

type TenseReferenceProps = {
  onSwitchView?: () => void;
};

export function TenseReference({ onSwitchView }: TenseReferenceProps = {}) {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = groupFilter === 'all'
    ? TENSE_REFERENCE_DATA
    : TENSE_REFERENCE_DATA.filter((t) => t.group === groupFilter);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={BookOpen02Icon} size={20} className="text-[var(--brand-9)]" />
          <span className="text-base font-bold text-[var(--gray-12)]">Справочник времён</span>
        </div>
        {onSwitchView && (
          <Button
            variant="ghost"
            size="compact"
            onClick={onSwitchView}
            className="text-[var(--brand-11)]"
          >
            Квиз
          </Button>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5">
        {LEGEND_ITEMS.map((item) => (
          <span
            key={item.label}
            className={cn('rounded px-2 py-0.5 text-[11px] font-medium', item.className)}
          >
            {item.label}
          </span>
        ))}
      </div>

      {/* Group filter */}
      <div className="flex gap-2">
        {GROUP_LABELS.map((g) => (
          <Button
            key={g.value}
            variant={groupFilter === g.value ? 'default' : 'secondary'}
            size="compact"
            onClick={() => {
              setGroupFilter(g.value);
              setExpandedId(null);
            }}
          >
            {g.label}
          </Button>
        ))}
      </div>

      {/* Tense cards */}
      <div className="flex flex-col gap-2">
        {filtered.map((tense) => (
          <TenseCard
            key={tense.id}
            tense={tense}
            isExpanded={expandedId === tense.id}
            onToggle={() => handleToggle(tense.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── TenseCard ────────────────────────────────────────────────────────────────

function TenseCard({
  tense,
  isExpanded,
  onToggle,
}: {
  tense: TenseReferenceItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    onToggle();
    // Scroll into view after expand animation starts
    if (!isExpanded) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [onToggle, isExpanded]);

  return (
    <div ref={cardRef} className="overflow-hidden rounded-2xl bg-[var(--gray-2)]">
      {/* Header — tap target */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[var(--gray-3)]"
        style={{ minHeight: 48 }}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--gray-12)]">{tense.name}</p>
          <p className="text-xs text-[var(--gray-11)]">{tense.shortDescription}</p>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={18} className="text-[var(--gray-11)]" />
        </motion.div>
      </button>

      {/* Expandable content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-3 px-4 pb-4">
              <Separator />

              {/* 3 forms */}
              {tense.forms.map((form, idx) => (
                <div key={form.label} className="flex flex-col gap-1.5">
                  {idx > 0 && <Separator className="my-1" />}
                  <p className="text-xs font-semibold text-[var(--gray-11)] uppercase tracking-wide">
                    {form.label}
                  </p>
                  {/* Formula */}
                  <div className="flex flex-wrap items-center gap-0.5 text-sm">
                    {form.formula.map((part, i) => (
                      <FormulaPartSpan key={i} part={part} />
                    ))}
                  </div>
                  {/* Examples */}
                  {form.examples.map((ex, exIdx) => (
                    <ExampleBlock key={exIdx} example={ex} />
                  ))}
                </div>
              ))}

              {/* Signal words */}
              {tense.signalWords.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Separator className="my-1" />
                  <p className="text-xs font-semibold text-[var(--gray-11)]">
                    Сигнальные слова
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {tense.signalWords.map((word) => (
                      <Badge key={word} variant="default" className="text-[11px]">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Usage tip */}
              <div className="rounded-xl bg-[var(--amber-2)] px-3 py-2">
                <p className="text-xs text-[var(--amber-11)]">{tense.usageTip}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ExampleBlock ─────────────────────────────────────────────────────────────

function ExampleBlock({ example }: { example: ExampleSentence }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-[var(--gray-3)] px-3 py-2">
      <p className="text-sm leading-relaxed">
        {example.parts.map((part, i) => (
          <span key={i} className={EXAMPLE_STYLES[part.role]}>{part.text}</span>
        ))}
      </p>
      <p className="text-xs text-[var(--gray-11)]">{example.translation}</p>
      {example.note && (
        <p className="text-[11px] italic text-[var(--gray-10)]">{example.note}</p>
      )}
    </div>
  );
}

// ─── FormulaPartSpan ──────────────────────────────────────────────────────────

function FormulaPartSpan({ part }: { part: FormulaPart }) {
  return <span className={ROLE_STYLES[part.role]}>{part.text}</span>;
}
