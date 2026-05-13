import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, BookOpen02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  ARTICLE_REFERENCE_DATA,
  type ArticleRuleItem,
  type ArticleExample,
  type ArticleGroup,
  type ArticlePartRole,
} from './article-reference-data';

// ─── Color Mapping ────────────────────────────────────────────────────────────

// Inline example styles — colored text only, no background (like tense-reference EXAMPLE_STYLES)
const ARTICLE_STYLES: Record<ArticleGroup, Record<ArticlePartRole, string>> = {
  indefinite: {
    article: 'font-semibold text-[var(--blue-11)]',
    plain: 'text-[var(--gray-12)]',
  },
  definite: {
    article: 'font-semibold text-[var(--violet-11)]',
    plain: 'text-[var(--gray-12)]',
  },
  zero: {
    article: 'font-semibold text-[var(--green-11)]',
    plain: 'text-[var(--gray-12)]',
  },
  expressions: {
    article: 'font-semibold text-[var(--amber-11)]',
    plain: 'text-[var(--gray-12)]',
  },
};

const GROUP_BORDER_COLORS: Record<ArticleGroup, string> = {
  indefinite: 'bg-[var(--blue-8)]',
  definite: 'bg-[var(--violet-8)]',
  zero: 'bg-[var(--green-8)]',
  expressions: 'bg-[var(--amber-8)]',
};

const LEGEND_ITEMS = [
  { label: 'a / an', className: 'bg-[var(--blue-3)] text-[var(--blue-11)]' },
  { label: 'the', className: 'bg-[var(--violet-3)] text-[var(--violet-11)]' },
  { label: '— (без артикля)', className: 'bg-[var(--green-3)] text-[var(--green-11)]' },
  { label: 'Выражения', className: 'bg-[var(--amber-3)] text-[var(--amber-11)]' },
];

type GroupFilter = 'all' | ArticleGroup;

const GROUP_LABELS: { value: GroupFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'indefinite', label: 'a / an' },
  { value: 'definite', label: 'the' },
  { value: 'zero', label: '—' },
  { value: 'expressions', label: 'Выражения' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

type ArticleReferenceProps = {
  onSwitchView?: () => void;
};

export function ArticleReference({ onSwitchView }: ArticleReferenceProps = {}) {
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = groupFilter === 'all'
    ? ARTICLE_REFERENCE_DATA
    : ARTICLE_REFERENCE_DATA.filter((r) => r.group === groupFilter);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={BookOpen02Icon} size={20} className="text-[var(--brand-9)]" />
          <span className="text-base font-bold text-[var(--gray-12)]">Справочник по артиклям</span>
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
      <div className="flex gap-2 overflow-x-auto">
        {GROUP_LABELS.map((g) => (
          <Button
            key={g.value}
            variant={groupFilter === g.value ? 'default' : 'secondary'}
            size="compact"
            className="shrink-0"
            onClick={() => {
              setGroupFilter(g.value);
              setExpandedId(null);
            }}
          >
            {g.label}
          </Button>
        ))}
      </div>

      {/* Rule cards */}
      <div className="flex flex-col gap-2">
        {filtered.map((rule) => (
          <ArticleRuleCard
            key={rule.id}
            rule={rule}
            isExpanded={expandedId === rule.id}
            onToggle={() => handleToggle(rule.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ArticleRuleCard ──────────────────────────────────────────────────────────

function ArticleRuleCard({
  rule,
  isExpanded,
  onToggle,
}: {
  rule: ArticleRuleItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const styles = ARTICLE_STYLES[rule.group];
  const borderColor = GROUP_BORDER_COLORS[rule.group];

  const handleToggle = useCallback(() => {
    onToggle();
    if (!isExpanded) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [onToggle, isExpanded]);

  return (
    <div ref={cardRef} className="overflow-hidden rounded-2xl bg-[var(--gray-2)]">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-[var(--gray-3)]"
        style={{ minHeight: 48 }}
      >
        <div className={cn('h-8 w-1 shrink-0 rounded-full', borderColor)} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--gray-12)]">{rule.title}</p>
          <p className="text-xs text-[var(--gray-11)]">{rule.shortDescription}</p>
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

              {/* Explanation */}
              <p className="text-sm text-[var(--gray-12)]">{rule.explanation}</p>

              {/* Examples */}
              {rule.examples.map((ex, i) => (
                <ExampleBlock key={i} example={ex} styles={styles} />
              ))}

              {/* Tip */}
              {rule.tip && (
                <div className="rounded-xl bg-[var(--amber-2)] px-3 py-2">
                  <p className="text-xs text-[var(--amber-11)]">{rule.tip}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── ExampleBlock ─────────────────────────────────────────────────────────────

function ExampleBlock({
  example,
  styles,
}: {
  example: ArticleExample;
  styles: Record<ArticlePartRole, string>;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-[var(--gray-3)] px-3 py-2">
      <p className="text-sm leading-relaxed">
        {example.parts.map((part, i) => (
          <span key={i} className={styles[part.role]}>{part.text}</span>
        ))}
      </p>
      <p className="text-xs text-[var(--gray-11)]">{example.translation}</p>
      {example.note && (
        <p className="text-[11px] italic text-[var(--gray-10)]">{example.note}</p>
      )}
    </div>
  );
}
