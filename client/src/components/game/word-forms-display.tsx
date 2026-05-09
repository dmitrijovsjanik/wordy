import { useMemo, useState } from 'react';
import type { WordFormInfo, WordFormsInfo } from '@/types/api';

// ─── Highlighted sentence ──────────────────────────────────────────────────
//
// Подсвечивает все формы целевого слова в предложении. По тапу на форму —
// в строке под предложением показывается её роль (например, «прошедшее время»).
// Повторный тап / тап на другую форму переключает или закрывает подсказку.

type HighlightedSentenceProps = {
  sentence: string;
  forms: WordFormInfo[];
  /** Цветовой класс для подсветки. По умолчанию — теплый акцент. */
  highlightClassName?: string;
};

type Segment =
  | { type: 'text'; text: string }
  | { type: 'highlight'; text: string; form: WordFormInfo; key: string };

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitSentence(sentence: string, forms: WordFormInfo[]): Segment[] {
  if (forms.length === 0) return [{ type: 'text', text: sentence }];

  // Сортируем по убыванию длины — длинные формы (won't, cannot) матчатся первыми.
  const sorted = [...forms].sort((a, b) => b.text.length - a.text.length);
  const lookup = new Map<string, WordFormInfo>();
  for (const f of sorted) {
    const key = f.text.toLowerCase();
    if (!lookup.has(key)) lookup.set(key, f);
  }

  const pattern = new RegExp(
    '\\b(' + sorted.map((f) => escapeRegex(f.text)).join('|') + ')\\b',
    'gi',
  );

  const segments: Segment[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let highlightCounter = 0;
  while ((match = pattern.exec(sentence)) !== null) {
    if (match.index > lastIdx) {
      segments.push({ type: 'text', text: sentence.slice(lastIdx, match.index) });
    }
    const matched = match[0];
    const form = lookup.get(matched.toLowerCase()) ?? sorted[0]!;
    segments.push({
      type: 'highlight',
      text: matched,
      form,
      key: `${match.index}-${highlightCounter++}`,
    });
    lastIdx = match.index + matched.length;
  }
  if (lastIdx < sentence.length) {
    segments.push({ type: 'text', text: sentence.slice(lastIdx) });
  }
  return segments;
}

export function HighlightedSentence({
  sentence,
  forms,
  highlightClassName = 'underline decoration-dotted underline-offset-4 decoration-[var(--gray-9)] cursor-pointer',
}: HighlightedSentenceProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const segments = useMemo(() => splitSentence(sentence, forms), [sentence, forms]);

  const activeSeg = activeKey
    ? (segments.find((s) => s.type === 'highlight' && s.key === activeKey) as
        | (Segment & { type: 'highlight' })
        | undefined)
    : undefined;

  if (forms.length === 0) {
    return <span>{sentence}</span>;
  }

  return (
    <span>
      {segments.map((seg, i) => {
        if (seg.type === 'text') return <span key={i}>{seg.text}</span>;
        const isActive = activeKey === seg.key;
        return (
          <button
            key={seg.key}
            type="button"
            className={`${highlightClassName} ${isActive ? 'text-[var(--accent-11)]' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveKey(isActive ? null : seg.key);
            }}
          >
            {seg.text}
          </button>
        );
      })}
      {activeSeg && (
        <span className="ml-1 inline-block rounded-full bg-[var(--gray-3)] px-2 py-0.5 text-xs text-[var(--gray-11)] align-middle">
          {activeSeg.form.label}
        </span>
      )}
    </span>
  );
}

// ─── Forms list (под словом) ───────────────────────────────────────────────
//
// Компактный список всех форм слова с лейблами. Используется на L1/L2/L3
// под основным словом, чтобы пользователь видел все формы сразу.

type WordFormsListProps = {
  forms: WordFormsInfo;
  /** Пропускаем форму, совпадающую с base (чтобы не дублировать слово). */
  hideBase?: boolean;
};

export function WordFormsList({ forms, hideBase = false }: WordFormsListProps) {
  const items = useMemo(() => {
    if (!hideBase) return forms.forms;
    const baseLower = forms.base.toLowerCase();
    return forms.forms.filter((f) => f.text.toLowerCase() !== baseLower);
  }, [forms, hideBase]);

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[var(--gray-11)]">
      {items.map((f, i) => (
        <span key={i} className="whitespace-nowrap">
          <span className="font-medium text-[var(--gray-12)]">{f.text}</span>
          <span className="text-[var(--gray-10)]"> · {f.label}</span>
        </span>
      ))}
    </div>
  );
}
