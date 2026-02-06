# Typo Generators — Универсальная библиотека генерации опечаток

Модульная система для генерации вариантов написания английских слов с опечатками "на лету".

---

## Использование

### Важно: минимальная длина слова

Генератор работает только для слов **≥ 4 буквы**. Короткие слова (cat, dog, the) пропускаются — для них используется стандартный multiple-choice формат.

```typescript
import { canGenerateSpelling } from '../spelling';

canGenerateSpelling('cat');   // false (3 буквы)
canGenerateSpelling('team');  // true (4 буквы)
canGenerateSpelling('hello'); // true (5 букв)
```

### Базовый пример

```typescript
import { generateSpellingOptions } from './typo-generators';

// Получить 6 вариантов для квиза (1 правильный + 5 опечаток)
const options = generateSpellingOptions('team', 6);
// → ['teem', 'team', 'tim', 'tiem', 'taem', 'tem'] (перемешаны)
```

### Только опечатки (без правильного)

```typescript
import { generateTypoVariants } from './typo-generators';

const typos = generateTypoVariants('hello', { totalVariants: 5 });
// → ['helo', 'hlelo', 'helol', 'ehllo', 'helllo']
```

### С метаданными (для отладки)

```typescript
import { generateTypoVariantsWithMeta } from './typo-generators';

const variants = generateTypoVariantsWithMeta('team', { totalVariants: 3 });
// → [
//   { variant: 'teem', type: 'phonetic-vowel', confidence: 0.95 },
//   { variant: 'tim', type: 'phonetic-vowel', confidence: 0.95 },
//   { variant: 'taem', type: 'transposition', confidence: 0.85 }
// ]
```

### Детерминизм (для дуэлей)

```typescript
const seed = 42;
const options1 = generateSpellingOptions('team', 6, seed);
const options2 = generateSpellingOptions('team', 6, seed);
// options1 === options2 (одинаковый порядок)
```

---

## Типы опечаток

### 1. Double Letter (приоритет: 10)
Удвоение/упрощение букв (максимум 2 буквы подряд)

| Исходное | Варианты |
|----------|----------|
| hello | helo (ll→l) |
| necessary | neccessary (c→cc), necesary (ss→s) |
| balloon | baloon (ll→l), ballon (oo→o) |

**Важно:** Генератор НЕ создаёт тройные буквы (lll, sss). Максимум — 2 подряд.

### 2. Phonetic (приоритет: 9)
Фонетические замены

**Гласные:**
- ea → ee, ie, e, i (team → teem, tiem)
- ie ↔ ei (receive → recieve)
- ou ↔ ow (house → howse)

**Согласные:**
- ph → f (phone → fone)
- ght → t, te (night → nite)
- ck → k, c (back → bak)

**Окончания:**
- tion → shun, sion (action → acshun)
- ous → us (famous → famus)

### 3. Transposition (приоритет: 8)
Перестановка соседних букв

| Исходное | Варианты |
|----------|----------|
| team | taem, tema, etam |
| friend | freind, firend |

### 4. Suffix (приоритет: 7)
Ошибки в суффиксах

| Паттерн | Варианты |
|---------|----------|
| -ful → -full | beautiful → beautifull |
| -ly → -ley, -lly | really → realy |
| -able ↔ -ible | possible → possable |

### 5. Silent Letter (приоритет: 6)
Немые буквы

| Исходное | Варианты |
|----------|----------|
| knight | night (kn → n) |
| write | rite (wr → r) |
| climb | clim (mb → m) |

---

## API

### `generateSpellingOptions(word, totalOptions?, seed?)`

Генерирует полный набор вариантов для spelling quiz.

**Параметры:**
- `word: string` — правильное написание
- `totalOptions: number` — общее количество (default: 6)
- `seed?: number` — для детерминизма

**Возвращает:** `string[]` — перемешанный массив с правильным ответом

**Пример:**
```typescript
generateSpellingOptions('team', 6)
// → ['teem', 'team', 'taem', 'tim', 'tiem', 'tem']
```

---

### `generateTypoVariants(word, config?)`

Генерирует только опечатки (без правильного слова).

**Параметры:**
- `word: string` — исходное слово
- `config?: CombinatorConfig`
  - `totalVariants?: number` — количество (default: 5)
  - `seed?: number` — для детерминизма
  - `filterRealWords?: boolean` — исключать реальные слова (default: false)

**Возвращает:** `string[]` — массив опечаток

---

### `generateTypoVariantsWithMeta(word, config?)`

Генерирует опечатки с метаданными (тип, confidence).

**Возвращает:** `TypoResult[]`
```typescript
type TypoResult = {
  variant: string;
  type: TypoType;
  confidence: number; // 0-1
};
```

---

## Архитектура

```
typo-generators/
├── types.ts              # Интерфейсы TypoGenerator, TypoResult
├── index.ts              # Комбинатор + API
├── double-letter.ts      # Удвоение/упрощение (priority: 10)
├── phonetic.ts           # Фонетика (priority: 9)
├── transposition.ts      # Перестановка (priority: 8)
├── suffix.ts             # Суффиксы (priority: 7)
└── silent-letter.ts      # Немые буквы (priority: 6)
```

### Как работает комбинатор

1. Запускает все 5 подгенераторов для слова
2. Собирает результаты (может быть 20-50 вариантов)
3. Дедуплицирует (исключает повторы и исходное слово)
4. Сортирует по `confidence` (от высшего к низшему)
5. Возвращает top-N с наивысшим confidence

---

## Добавление нового подгенератора

1. Создайте файл в `typo-generators/`:

```typescript
// my-generator.ts
import type { TypoGenerator, TypoGeneratorContext, TypoResult } from './types.js';

export class MyGenerator implements TypoGenerator {
  readonly id = 'my-generator';
  readonly priority = 5;

  generate(ctx: TypoGeneratorContext): TypoResult[] {
    const { word } = ctx;
    const results: TypoResult[] = [];

    // Ваша логика генерации
    results.push({
      variant: 'variant1',
      type: 'my-type',
      confidence: 0.8,
    });

    return results.sort((a, b) => b.confidence - a.confidence);
  }
}
```

2. Добавьте в массив `generators` в [index.ts](index.ts:26):

```typescript
const generators: TypoGenerator[] = [
  new DoubleLetterGenerator(),
  new PhoneticGenerator(),
  new TranspositionGenerator(),
  new SuffixGenerator(),
  new SilentLetterGenerator(),
  new MyGenerator(), // ← добавить
];
```

3. Готово! Комбинатор автоматически использует новый генератор.

---

## Производительность

- **Время генерации:** < 1ms на слово
- **Количество правил:** 50+ фонетических паттернов
- **Алгоритмическая сложность:** O(n) где n = длина слова

---

## Применение

Генератор не зависит от UI и может использоваться:

| Формат | Описание | Компонент |
|--------|----------|-----------|
| Spelling Quiz | 6 кнопок, выбрать правильное | `SpellingQuiz.tsx` |
| Word Field | Варианты разбросаны вокруг слова | `WordField.tsx` |
| Toggle Cards | Toggle-кнопки с вариантами | `ToggleSpelling.tsx` |
| Swipe Cards | Свайп влево/вправо | `SwipeSpelling.tsx` |

---

## Тестирование

```bash
npx tsx test-typo-generator.ts
```

Проверяет:
- Генерацию для 10 тестовых слов
- Детерминизм (seed)
- Качество опечаток
