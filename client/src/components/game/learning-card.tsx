import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { VolumeHighIcon, Loading03Icon } from '@hugeicons/core-free-icons';
import { MagicText } from '@/components/ui/magic-text';
import { WordFormsInline, WordFormsDetails } from '@/components/game/word-forms-display';
import { speakText } from '@/lib/tts';
import { cn } from '@/lib/utils';
import type { WordFormsInfo } from '@/types/api';

export type LearningCardMeaning = {
  meaningId: number;
  translation: string;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  example?: { en: string; ru: string } | null;
};

/**
 * Что закрыто магическими частицами. Чего нет в объекте — рендерится текстом.
 * revealed=false → перечисленные поля в частицах. revealed=true → всё видно.
 *
 * Канон по уровням:
 *   L0 (encounter) — blur не задаётся вовсе (revealed всегда true).
 *   L2 (passive)   — blur: { translation, exampleRu }. Hold-to-reveal.
 *   L3 (active)    — blur: { word, transcription, exampleEn }. Reveal по ответу.
 */
export type LearningCardBlur = {
  word?: boolean;
  transcription?: boolean;
  translation?: boolean;
  exampleEn?: boolean;
  exampleRu?: boolean;
  /** Магический блюр инлайн-строки форм слова. На L3 active recall формы —
   *  подсказка, раскрывающая слово, поэтому до ответа их прячем. */
  forms?: boolean;
};

type LearningCardProps = {
  /** Подпись в шапке карточки. Пример: «Решите, знаете ли вы это слово». */
  prompt: string;
  word: string;
  transcription: string | null;
  meanings: LearningCardMeaning[];
  /** Какие текстовые узлы рендерить через <MagicText>. */
  blur?: LearningCardBlur;
  /** false = blur-узлы в частицах. true = всё видно. */
  revealed: boolean;
  /** Что произносить TTS. По умолчанию — word. */
  audioWord?: string;
  /** Скрывает кнопку TTS. На L3 active recall кнопка нужна только после ответа,
   *  иначе юзер услышит слово до ввода и обойдёт упражнение. */
  hideAudio?: boolean;
  /** Вызывается когда юзер нажал «Подробнее». Если не задан — кнопка не показывается.
   *  Кнопка открывает дровер с полным списком значений и расшифровкой форм слова. */
  onShowAll?: () => void;
  /** Прячет «Подробнее» (нужно внутри bottom-sheet, чтобы не плодилось вложений).
   *  Также отключает динамическое урезание — рендерим все meanings подряд. */
  hideShowAll?: boolean;
  /** Дополнительный контент поверх карточки (overlays типа ✓/✗). */
  overlay?: React.ReactNode;
  /** Контент ПОД основным телом, но НАД фоном — для ripple-заливки L0. */
  backgroundOverlay?: React.ReactNode;
  /** Цвет слова. По умолчанию — белый. На L3 используется для feedback по результату:
   *  exact → var(--green-9), close → var(--amber-9), wrong → var(--red-9). */
  wordColor?: string;
  /** Убирает фон/скругление контейнера карточки. Используется внутри drawer'а,
   *  где фон рисует сам drawer. */
  flat?: boolean;
  /** Скрывает строку prompt сверху. В drawer'е заголовок не нужен. */
  hidePrompt?: boolean;
  /** Контент справа на уровне строки слова (например, кнопка закрытия дровера). */
  wordRightSlot?: React.ReactNode;
  /** Грамматические формы слова. Рендерятся сразу после транскрипции inline-строкой. */
  forms?: WordFormsInfo | null;
  /** Колбэк по тапу на inline-строку форм — открыть дровер с расшифровкой.
   *  Если не задан, inline-строка рендерится как обычный текст. */
  onShowForms?: () => void;
  /** Внутри дровера: вместо inline-строки форм рендерим табличку с лейблами. */
  formsDetailed?: boolean;
};

/**
 * Общий каркас обучающей карточки (L0/L2/L3). Разные уровни различаются только
 * тем, какие поля помечены `blur.*` и значением `revealed`.
 *
 * Динамическое урезание списка переводов:
 *   - Карточка занимает всю доступную высоту parent'а (flex-1 в LearningCard).
 *   - В контейнере meanings рендерятся ВСЕ, измеряются через offscreen-копию.
 *   - Через ResizeObserver пересчитывается сколько строк влезает в `availableHeight`.
 *   - Лишние скрываются; кнопка «Подробнее» появляется когда есть скрытые
 *     значения ИЛИ грамматические формы (открывает дровер с обоими блоками).
 *   - Минимум — 1 видимая строка, даже если она частично обрезана (overflow-hidden).
 *   - При `hideShowAll=true` (внутри drawer'а) урезание не применяется.
 */
export function LearningCard({
  prompt,
  word,
  transcription,
  meanings,
  blur,
  revealed,
  audioWord,
  hideAudio,
  onShowAll,
  hideShowAll,
  overlay,
  backgroundOverlay,
  wordColor,
  flat,
  hidePrompt,
  wordRightSlot,
  forms,
  onShowForms,
  formsDetailed,
}: LearningCardProps) {
  const meaningsContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLUListElement>(null);
  // Стартуем с 0: useLayoutEffect посчитает реальное количество ДО первого paint,
  // мигания не будет. Если бы стартовали с meanings.length — на первом кадре все
  // строки были бы видны и «выталкивали» layout.
  const [visibleCount, setVisibleCount] = useState<number>(0);
  // TTS-кнопка: показываем спиннер пока речь грузится.
  const [ttsLoading, setTtsLoading] = useState(false);

  const handleSpeak = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ttsLoading) return;
    setTtsLoading(true);
    try {
      const audio = await speakText(audioWord ?? word);
      // Спиннер убираем как только аудио начало воспроизводиться (или скачалось).
      setTtsLoading(false);
      // На всякий: если воспроизведение прервётся ошибкой — не повисает.
      audio.addEventListener('error', () => setTtsLoading(false), { once: true });
    } catch {
      setTtsLoading(false);
    }
  };

  // Пересчитываем visibleCount: измеряем offscreen-копию (все meanings),
  // сравниваем суммарную высоту строк с availableHeight контейнера.
  useLayoutEffect(() => {
    if (hideShowAll) {
      setVisibleCount(meanings.length);
      return;
    }
    const container = meaningsContainerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const compute = () => {
      // -4px на sub-pixel rounding: getBoundingClientRect возвращает дробные
      // значения, а clientHeight округлён. Без запаса последняя строка иногда
      // «вмещается» в подсчёте, но визуально упирается в нижнюю границу/
      // следующий блок — кнопка «Подробнее» не появляется.
      const available = container.clientHeight - 4;
      if (available <= 0) {
        // Контейнер ещё не получил высоту — оставляем 1 (минимум).
        // Лучше показать одну чем все — иначе все вылезут в overflow и юзер
        // увидит мусор до того как ResizeObserver перепосчитает.
        setVisibleCount(Math.min(1, meanings.length));
        return;
      }
      const rows = Array.from(measure.children) as HTMLElement[];
      if (rows.length === 0) {
        setVisibleCount(0);
        return;
      }
      // gap-2 = 8px зазор между li. Учитываем зазоры между рядами.
      const GAP = 8;
      let used = 0;
      let count = 0;
      for (let i = 0; i < rows.length; i++) {
        const h = rows[i]!.getBoundingClientRect().height;
        const gap = i > 0 ? GAP : 0;
        const candidate = used + gap + h;
        if (candidate <= available) {
          used = candidate;
          count = i + 1;
        } else {
          // Минимум 1 — даже если первая строка не влезает, показываем её
          // (контейнер обрежет через overflow-hidden).
          if (count === 0) count = 1;
          break;
        }
      }
      setVisibleCount(count);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    return () => ro.disconnect();
  }, [meanings, hideShowAll]);

  // Если meanings обновился между рендерами, нужно сразу обнулить visibleCount
  // к meanings.length чтобы не остаться на старом значении (например, после
  // открытия drawer с hideShowAll=true).
  useEffect(() => {
    if (hideShowAll) setVisibleCount(meanings.length);
  }, [meanings.length, hideShowAll]);

  const visibleMeanings = hideShowAll ? meanings : meanings.slice(0, visibleCount);
  const hiddenCount = meanings.length - visibleMeanings.length;

  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col overflow-hidden',
        !flat && 'rounded-[48px] bg-[var(--gray-3)]',
      )}
    >
      {backgroundOverlay}
      <div className="relative flex flex-1 flex-col gap-6 p-8">
        {!hidePrompt && (
          <p className="shrink-0 text-base leading-[22px] text-white">{prompt}</p>
        )}

        {/* Блок слова имеет естественную высоту. Не растягивается — иначе
            заберёт всё пространство и контейнер meanings схлопнется в 0. */}
        <div className="flex shrink-0 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            {blur?.word ? (
              <MagicText
                text={word}
                revealed={revealed}
                fontSize={32}
                fontWeight={600}
                color={wordColor ?? 'rgba(255, 255, 255, 1)'}
                spread={28}
              />
            ) : (
              <h1
                className="text-[32px] font-semibold leading-10 transition-colors"
                style={{ color: wordColor ?? 'white' }}
              >
                {word}
              </h1>
            )}
            {wordRightSlot && <div className="shrink-0">{wordRightSlot}</div>}
          </div>
          {transcription && (
            blur?.transcription ? (
              <MagicText
                text={`[${transcription}]`}
                revealed={revealed}
                fontSize={16}
                fontWeight={400}
                color="rgba(174, 177, 181, 1)"
                spread={16}
              />
            ) : (
              <p className="text-base leading-[22px] text-[var(--gray-11)]">[{transcription}]</p>
            )
          )}
          {forms && forms.forms.length > 0 && (
            blur?.forms ? (
              // Magic-blur инлайн-строки форм. detailed-режим (внутри дровера)
              // визуально откроется вместе со словом — там тоже через MagicText.
              <MagicText
                text={joinFormTexts(forms)}
                revealed={revealed}
                fontSize={12}
                fontWeight={400}
                color="rgba(174, 177, 181, 1)"
                spread={12}
              />
            ) : formsDetailed ? (
              <div className="mt-2">
                <WordFormsDetails forms={forms} />
              </div>
            ) : (
              <WordFormsInline forms={forms} onClick={onShowForms} />
            )
          )}
        </div>

        {/* Meanings-контейнер: flex-1 + min-h-0 → забирает всё свободное место
            между word-блоком и нижним рядом → clientHeight = реальное available.
            Внутри `justify-end` прижимает список к низу: когда meanings мало,
            они «лежат» внизу, а пустое место — между word и meanings. */}
        <div
          ref={meaningsContainerRef}
          className="relative flex min-h-0 flex-1 flex-col justify-end overflow-hidden"
        >
          <ul className="flex flex-col gap-2">
            {visibleMeanings.map((m, idx) => (
              <MeaningRow
                key={m.meaningId}
                meaning={m}
                isLast={idx === visibleMeanings.length - 1}
                blur={blur}
                revealed={revealed}
              />
            ))}
          </ul>

          {/* Offscreen-измеритель: рендерит ВСЕ meanings для подсчёта высот.
              aria-hidden, visibility hidden, position absolute — не виден юзеру
              и не влияет на лейаут. Имеет ту же ширину что и видимый список. */}
          <ul
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-0 flex flex-col gap-2 opacity-0"
            style={{ visibility: 'hidden' }}
          >
            {meanings.map((m, idx) => (
              <MeaningRow
                key={`measure-${m.meaningId}`}
                meaning={m}
                isLast={idx === meanings.length - 1}
                blur={blur}
                revealed={revealed}
              />
            ))}
          </ul>
        </div>

        {/* Нижний ряд кнопок: фиксированная высота 36px (size-9 = TTS-кнопка)
            независимо от того, какие кнопки видны. Иначе появление/исчезновение
            «Подробнее» или TTS сдвигает meanings выше/ниже.
            «Подробнее» показывается если есть либо обрезанные значения,
            либо грамматические формы — кнопка раскрывает оба блока. */}
        <div className="flex h-9 shrink-0 items-center justify-between">
          {!hideShowAll && onShowAll && (hiddenCount > 0 || (forms && forms.forms.length > 0)) && (
            <button
              type="button"
              onClick={onShowAll}
              onPointerDown={(e) => e.stopPropagation()}
              className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium text-white active:bg-white/15"
            >
              Подробнее
            </button>
          )}
          {!hideAudio && (
            <button
              type="button"
              onClick={handleSpeak}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Озвучить"
              disabled={ttsLoading}
              className="ml-auto flex size-9 items-center justify-center rounded-full active:bg-white/10 disabled:opacity-60"
            >
              <HugeiconsIcon
                icon={ttsLoading ? Loading03Icon : VolumeHighIcon}
                size={18}
                className={cn('text-white', ttsLoading && 'animate-spin')}
                strokeWidth={2}
              />
            </button>
          )}
        </div>
      </div>

      {overlay}
    </div>
  );
}

// ─── Meaning row ─────────────────────────────────────────────────────────────

function MeaningRow({
  meaning,
  isLast,
  blur,
  revealed,
}: {
  meaning: LearningCardMeaning;
  isLast: boolean;
  blur?: LearningCardBlur;
  revealed: boolean;
}) {
  return (
    <li
      className={cn(
        'flex flex-col gap-2 pb-2',
        !isLast && 'border-b border-white/10',
      )}
    >
      <div className="flex items-baseline gap-2 text-sm leading-5">
        {blur?.translation ? (
          <MagicText
            text={meaning.translation}
            revealed={revealed}
            fontSize={14}
            fontWeight={700}
            color="rgba(255, 255, 255, 1)"
            spread={14}
          />
        ) : (
          <span className="font-bold text-white">{meaning.translation}</span>
        )}
        <span className="italic text-[var(--gray-11)]">{shortPos(meaning.partOfSpeech)}</span>
      </div>
      {meaning.example && (
        <div className="flex flex-col gap-0.5 text-xs leading-[18px]">
          {blur?.exampleEn ? (
            <MagicText
              text={meaning.example.en}
              revealed={revealed}
              fontSize={12}
              fontWeight={400}
              color="rgba(255, 255, 255, 1)"
              spread={12}
            />
          ) : (
            <span className="text-white">{meaning.example.en}</span>
          )}
          {blur?.exampleRu ? (
            <MagicText
              text={meaning.example.ru}
              revealed={revealed}
              fontSize={12}
              fontWeight={400}
              color="rgba(174, 177, 181, 1)"
              spread={12}
            />
          ) : (
            <span className="text-[var(--gray-11)]">{meaning.example.ru}</span>
          )}
        </div>
      )}
    </li>
  );
}

// Дублирует логику WordFormsInline.useMemo — нужна одна строка для MagicText.
// Дедуп по lower-case, порядок сохраняем.
function joinFormTexts(forms: WordFormsInfo): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const f of forms.forms) {
    const key = f.text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f.text);
  }
  return out.join(', ');
}

function shortPos(pos: LearningCardMeaning['partOfSpeech']): string {
  const map: Record<LearningCardMeaning['partOfSpeech'], string> = {
    noun: 'сущ',
    verb: 'гл',
    adj: 'прил',
    adv: 'нар',
    phrase: 'фраза',
  };
  return map[pos] ?? '';
}
