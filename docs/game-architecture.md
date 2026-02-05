# Game Architecture (Modes, Question Types, Generators)

Модульная архитектура для разных режимов игры и типов вопросов. Позволяет комбинировать любой режим с любым типом вопроса.

## Три уровня абстракции

```
┌─────────────────────────────────────────────────────────────────┐
│  GameMode          │  Правила игры: лимиты, награды, UI        │
│  (infinite/session/duel)                                       │
├─────────────────────────────────────────────────────────────────┤
│  QuestionType      │  UI компонент и логика взаимодействия     │
│  (multiple-choice/spelling/text-input/match-pairs)             │
├─────────────────────────────────────────────────────────────────┤
│  Generator         │  Генерация контента вопроса               │
│  (en→ru, ru→en, spelling variants, etc.)                       │
└─────────────────────────────────────────────────────────────────┘
```

## GameMode — режим игры

Определяет **правила и контекст**, не влияет на UI вопросов.

| Mode | Описание | Особенности |
|------|----------|-------------|
| `infinite` | Бесконечная лента на главной | Нет лимита, streak, XP/LP награды |
| `session` | Сессия из N вопросов | Фиксированное количество, результат в конце |
| `duel` | PvP дуэль | Одинаковые вопросы для обоих игроков, таймер |

```ts
// client/src/types/game.ts
type GameModeConfig = {
  infinite: { mode: 'infinite'; collectionId?: number };
  session: { mode: 'session'; questionCount: number; collectionId?: number };
  duel: { mode: 'duel'; duelId: number; opponentId: number };
};
```

## QuestionType — тип вопроса

Определяет **UI и взаимодействие**. Каждый тип — отдельный компонент в `client/src/components/game/question-types/`.

| Type | UI | Файл |
|------|-----|------|
| `multiple-choice` | Сетка 2×2 кнопок | `multiple-choice.tsx` |
| `spelling` | Сетка вариантов написания | `spelling.tsx` (TODO) |
| `text-input` | Текстовое поле ввода | `text-input.tsx` (TODO) |
| `match-pairs` | Соединение пар drag-n-drop | `match-pairs.tsx` (TODO) |

**Контракт компонента типа вопроса:**
```tsx
type QuestionComponentProps<T extends Question> = {
  question: T;
  questionKey: string | number;  // для уникальных key
  selectedAnswer: string | null;
  feedback: AnswerFeedback | null;
  disabled?: boolean;
  onAnswer: (answer: string) => void;
  onSkip?: () => void;
  showSkip?: boolean;
};
```

**Добавление нового типа:**
1. Добавить тип в `client/src/types/game.ts` → union `Question`
2. Создать компонент в `client/src/components/game/question-types/`
3. Создать генератор на сервере (см. ниже)
4. Добавить рендер в родительском компоненте (switch по `question.type`)

## Generator — генератор вопросов (сервер)

Живут в `server/src/services/game/generators/`. Отвечают за создание данных вопроса из БД.

**Текущие генераторы:**
```
server/src/services/game/generators/
├── index.ts              # Реэкспорт
└── multiple-choice.ts    # Генерация multiple-choice вопросов
```

**Функции генератора:**
```ts
// Из конкретного meaning (слово уже выбрано SRS-алгоритмом)
generateFromMeaning(meaning, langPair) → Question

// Из кастомного слова пользователя
generateFromCustomWord(customWord, allCustom, langPair) → Question

// Случайный вопрос (fallback)
generateRandom(excludeIds, langPair) → Question | null
```

**Константы фильтрации** (в `multiple-choice.ts`):
```ts
MAX_POPULARITY_RANK = 3   // Только топ-3 перевода из Yandex
MIN_FREQUENCY = 2         // Минимальная частотность
CYRILLIC_FILTER           // Перевод содержит кириллицу
```

**Добавление нового генератора:**
1. Создать файл в `server/src/services/game/generators/`
2. Экспортировать функции генерации
3. Добавить экспорт в `generators/index.ts`
4. Использовать в соответствующем роуте/сервисе

## Shared Components — переиспользуемые компоненты

Живут в `client/src/components/game/`:

| Компонент | Назначение |
|-----------|------------|
| `WordDisplay` | Отображение слова + originalForm + транскрипция |
| `RewardFeedback` | Анимация награды XP/LP |
| `StreakIndicator` | Индикатор серии с частицами |

## Типы (клиент)

Все игровые типы в `client/src/types/game.ts`:

```ts
// Режимы
type GameMode = 'infinite' | 'session' | 'duel';

// Типы вопросов (union)
type Question =
  | MultipleChoiceQuestion
  | SpellingQuestion
  | TextInputQuestion
  | MatchPairsQuestion;

// Фидбек ответа
type AnswerFeedback = {
  isCorrect: boolean;
  correctAnswer: string;
  xpEarned?: number;
  // ...
};

// Состояние игры
type GameState = { mode, currentQuestion, streak, ... };
```

## Типы (сервер)

Типы в `server/src/services/game/types.ts`:

```ts
type QuestionDirection = 'en-ru' | 'ru-en';
type LegacyQuestion = { meaningId, word, options, ... };  // текущий формат API
type PooledMeaning = { id, wordId, translation, word: {...} };
```

## Как добавить новый режим игры

1. Добавить в `GameMode` type и `GameModeConfig`
2. Добавить конфигурацию в `unified-game-store.ts`
3. Создать страницу/компонент для режима
4. Подключить к роутеру

## Как добавить новый тип вопроса

**Клиент:**
1. Добавить тип в `Question` union (`types/game.ts`)
2. Создать компонент в `components/game/question-types/`
3. Добавить рендер в родительских компонентах

**Сервер:**
1. Добавить тип в `server/src/services/game/types.ts`
2. Создать генератор в `generators/`
3. Добавить роут или расширить существующий

## Пример: добавление Spelling типа

```ts
// 1. client/src/types/game.ts — добавить тип
export type SpellingQuestion = BaseQuestion & {
  type: 'spelling';
  options: string[];        // варианты написания: ['team', 'teem', 'tim']
  correctSpelling: string;  // правильное: 'team'
};

// 2. client/src/components/game/question-types/spelling.tsx
export function Spelling({ question, feedback, onAnswer }: SpellingProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {question.options.map(option => (
        <Button key={option} onClick={() => onAnswer(option)}>
          {option}
        </Button>
      ))}
    </div>
  );
}

// 3. server/src/services/game/generators/spelling.ts
export async function generateSpellingQuestion(meaning: PooledMeaning): Promise<SpellingQuestion> {
  const variants = generateMisspellings(meaning.word.text); // алгоритм генерации опечаток
  return {
    type: 'spelling',
    meaningId: meaning.id,
    word: meaning.translation,  // показываем русское слово
    options: shuffle([meaning.word.text, ...variants]),
    correctSpelling: meaning.word.text,
    // ...
  };
}
```
