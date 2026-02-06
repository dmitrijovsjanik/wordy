import type { Axis } from './types.js';

// ─── Phonetic Axis Rules ────────────────────────────────────────────────────

type PhoneticAxisRule = {
  pattern: RegExp;
  wrong: string;
  confidence: number;
  /** true = паттерн якорится на начало слова */
  anchorStart?: boolean;
};

const PHONETIC_RULES: PhoneticAxisRule[] = [
  // Замена согласных (минимальные изменения)
  { pattern: /^w/, wrong: 'v', confidence: 0.95, anchorStart: true },
  { pattern: /^v/, wrong: 'w', confidence: 0.9, anchorStart: true },
  { pattern: /^th/, wrong: 's', confidence: 0.9, anchorStart: true },
  { pattern: /^th/, wrong: 'f', confidence: 0.85, anchorStart: true },
  { pattern: /ph/, wrong: 'pf', confidence: 0.95 },
  { pattern: /ck/, wrong: 'k', confidence: 0.9 },

  // Немые буквы (drop silent letter)
  { pattern: /eau/, wrong: 'eu', confidence: 0.85 },
  { pattern: /ea/, wrong: 'e', confidence: 0.9 },
  { pattern: /ie/, wrong: 'ia', confidence: 0.9 },
  { pattern: /ie/, wrong: 'i', confidence: 0.8 },
  { pattern: /ou/, wrong: 'u', confidence: 0.8 },
];

// ─── Suffix Axis Rules ──────────────────────────────────────────────────────

type SuffixAxisRule = {
  pattern: RegExp;
  wrong: string;
  confidence: number;
};

const SUFFIX_RULES: SuffixAxisRule[] = [
  { pattern: /ful$/, wrong: 'full', confidence: 0.9 },
  { pattern: /full$/, wrong: 'ful', confidence: 0.85 },
  { pattern: /able$/, wrong: 'abel', confidence: 0.85 },
  { pattern: /ible$/, wrong: 'ibel', confidence: 0.85 },
  { pattern: /ble$/, wrong: 'bel', confidence: 0.8 },
  { pattern: /ary$/, wrong: 'ery', confidence: 0.8 },
  { pattern: /ery$/, wrong: 'ary', confidence: 0.8 },
  { pattern: /ance$/, wrong: 'ence', confidence: 0.8 },
  { pattern: /ence$/, wrong: 'ance', confidence: 0.8 },
  { pattern: /tion$/, wrong: 'sion', confidence: 0.8 },
  { pattern: /sion$/, wrong: 'tion', confidence: 0.8 },
];

// Буквы которые могут быть удвоены в английском
const DOUBLEABLE = new Set('bcdfgklmnprst'.split(''));

// ─── Axis Finders ───────────────────────────────────────────────────────────

/**
 * Находит все оси фонетических замен
 */
function findPhoneticAxes(word: string): Axis[] {
  const axes: Axis[] = [];

  for (const rule of PHONETIC_RULES) {
    const match = word.match(rule.pattern);
    if (!match || match.index === undefined) continue;

    const start = match.index;
    const end = start + match[0].length;
    const correct = match[0];

    // Проверяем что замена даёт валидный результат
    if (rule.wrong === correct) continue;

    axes.push({
      start,
      end,
      correct,
      wrong: rule.wrong,
      confidence: rule.confidence,
      type: 'phonetic',
    });
  }

  return axes;
}

/**
 * Находит оси для ght-кластера (декомпозиция на 2 независимые оси: g и h)
 */
function findGhtAxes(word: string): Axis[] {
  const axes: Axis[] = [];
  const idx = word.indexOf('ght');
  if (idx === -1) return axes;

  // Ось 1: g present/absent (ght → ht)
  axes.push({
    start: idx,
    end: idx + 1,
    correct: 'g',
    wrong: '',
    confidence: 0.85,
    type: 'ght-g',
  });

  // Ось 2: h present/absent (ght → gt)
  axes.push({
    start: idx + 1,
    end: idx + 2,
    correct: 'h',
    wrong: '',
    confidence: 0.85,
    type: 'ght-h',
  });

  return axes;
}

/**
 * Находит оси для удвоенных букв (только упрощение: ll→l, ss→s)
 */
function findDoubleLetterAxes(word: string): Axis[] {
  const axes: Axis[] = [];

  for (let i = 0; i < word.length - 1; i++) {
    if (word[i] === word[i + 1] && DOUBLEABLE.has(word[i]!)) {
      axes.push({
        start: i,
        end: i + 2,
        correct: word[i]! + word[i + 1]!,
        wrong: word[i]!,
        confidence: 0.9,
        type: 'double',
      });
      // Пропускаем следующую позицию (уже обработано)
      i++;
    }
  }

  return axes;
}

/**
 * Находит оси для суффиксов
 */
function findSuffixAxes(word: string): Axis[] {
  const axes: Axis[] = [];

  for (const rule of SUFFIX_RULES) {
    const match = word.match(rule.pattern);
    if (!match || match.index === undefined) continue;

    const start = match.index;
    const end = start + match[0].length;

    axes.push({
      start,
      end,
      correct: match[0],
      wrong: rule.wrong,
      confidence: rule.confidence,
      type: 'suffix',
    });
  }

  return axes;
}

/**
 * Находит ось немой e (универсальный fallback)
 * - Слово на e → убрать e
 * - Слово на согласную → добавить e
 */
function findSilentEAxis(word: string): Axis | null {
  const lastChar = word[word.length - 1];

  if (lastChar === 'e' && word.length > 3) {
    // Убрать немую e
    return {
      start: word.length - 1,
      end: word.length,
      correct: 'e',
      wrong: '',
      confidence: 0.75,
      type: 'silent-e',
    };
  }

  if (lastChar && !/[aeiou]/.test(lastChar)) {
    // Добавить немую e
    return {
      start: word.length,
      end: word.length,
      correct: '',
      wrong: 'e',
      confidence: 0.75,
      type: 'silent-e',
    };
  }

  return null;
}

/**
 * Находит оси замены гласных (a↔e, i↔e) — только для длинных слов
 */
function findVowelAxes(word: string): Axis[] {
  if (word.length < 6) return [];

  const axes: Axis[] = [];
  const vowelSwaps: [string, string][] = [
    ['a', 'e'],
    ['e', 'a'],
    ['i', 'e'],
  ];

  for (let i = 1; i < word.length - 1; i++) {
    const char = word[i]!;
    const nextChar = word[i + 1];

    // Пропускаем если следующая буква — гласная (диграф, обработан выше)
    if (nextChar && /[aeiou]/.test(nextChar)) continue;

    for (const [from, to] of vowelSwaps) {
      if (char === from) {
        axes.push({
          start: i,
          end: i + 1,
          correct: from,
          wrong: to!,
          confidence: 0.7,
          type: 'vowel',
        });
      }
    }
  }

  return axes;
}

// ─── Main API ───────────────────────────────────────────────────────────────

/**
 * Находит все возможные оси путаницы для слова
 * Отсортированы по confidence DESC
 */
export function findAllAxes(word: string): Axis[] {
  const lowerWord = word.toLowerCase();

  const allAxes: Axis[] = [
    ...findGhtAxes(lowerWord),
    ...findPhoneticAxes(lowerWord),
    ...findDoubleLetterAxes(lowerWord),
    ...findSuffixAxes(lowerWord),
    ...findVowelAxes(lowerWord),
  ];

  // Добавляем silent-e как fallback
  const silentE = findSilentEAxis(lowerWord);
  if (silentE) allAxes.push(silentE);

  // Сортируем по confidence DESC
  return allAxes.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Проверяет, пересекаются ли 2 оси по позициям
 */
export function axesOverlap(a: Axis, b: Axis): boolean {
  // Для осей с пустым correct (добавление e), start === end
  // Они не пересекаются с другими если их позиции не внутри другого диапазона
  const aStart = a.start;
  const aEnd = a.end === a.start ? a.start + 1 : a.end;
  const bStart = b.start;
  const bEnd = b.end === b.start ? b.start + 1 : b.end;

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Выбирает 2 лучшие непересекающиеся оси
 */
export function selectTwoAxes(axes: Axis[]): [Axis, Axis] | null {
  // Оси уже отсортированы по confidence DESC
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      if (!axesOverlap(axes[i]!, axes[j]!)) {
        return [axes[i]!, axes[j]!];
      }
    }
  }
  return null;
}

/**
 * Применяет оси к слову, генерируя 2x2 матрицу вариантов
 * Возвращает [correct, wrongA, wrongB, wrongAB]
 */
export function generateMatrix(
  word: string,
  axisA: Axis,
  axisB: Axis,
): [string, string, string, string] {
  const applyAxis = (w: string, axis: Axis): string => {
    return w.slice(0, axis.start) + axis.wrong + w.slice(axis.end);
  };

  // Сортируем оси по позиции (правая первая) для корректного применения
  const [first, second] = axisA.start > axisB.start
    ? [axisA, axisB] as const
    : [axisB, axisA] as const;

  const correct = word;
  const wrongFirst = applyAxis(word, first);
  const wrongSecond = applyAxis(word, second);

  // Для комбинированного: сначала правую ось, потом левую
  const wrongBoth = applyAxis(applyAxis(word, first), second);

  // Возвращаем в порядке: correct, wrongA, wrongB, wrongAB
  if (first === axisA) {
    return [correct, wrongFirst, wrongSecond, wrongBoth];
  }
  return [correct, wrongSecond, wrongFirst, wrongBoth];
}
