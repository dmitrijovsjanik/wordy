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

// ─── Inline-строка под транскрипцией ───────────────────────────────────────
//
// Все формы через запятую, 12px, без лейблов. Дубли (когда past=participle,
// например worked/worked) скрываются — сравниваем по lower-case text.
// По тапу открывается дровер с расшифровкой.

type WordFormsInlineProps = {
  forms: WordFormsInfo;
  onClick?: () => void;
};

export function WordFormsInline({ forms, onClick }: WordFormsInlineProps) {
  const texts = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const f of forms.forms) {
      const key = f.text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f.text);
    }
    return out;
  }, [forms]);

  if (texts.length === 0) return null;

  const content = texts.join(', ');

  if (!onClick) {
    return <p className="text-[12px] leading-tight text-[var(--gray-11)]">{content}</p>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left text-[12px] leading-tight text-[var(--gray-11)] active:text-[var(--gray-12)]"
    >
      {content}
    </button>
  );
}

// ─── Подробный список (внутри дровера) ─────────────────────────────────────
//
// Каждая строка: форма слева, лейбл справа. 12px. Без POS-заголовка.

type WordFormsDetailsProps = {
  forms: WordFormsInfo;
};

export function WordFormsDetails({ forms }: WordFormsDetailsProps) {
  if (forms.forms.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2 py-2">
      {forms.forms.map((f, i) => (
        <li key={i} className="text-[12px] leading-tight">
          <span className="font-medium text-[var(--gray-12)]">{f.text}</span>
          <span className="text-[var(--gray-10)]"> — {f.label}</span>
        </li>
      ))}
    </ul>
  );
}
