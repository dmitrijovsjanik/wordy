export const PLACEMENT_QUESTIONS_COUNT = 12;

// Сколько слов загружаем из БД на каждый уровень
export const WORDS_PER_LEVEL = 15;

// Уровни CEFR в порядке возрастания сложности
export const CEFR_ORDER = ['a1', 'a2', 'b1', 'b2'] as const;
export type PlacementCefrLevel = (typeof CEFR_ORDER)[number];

// Уровень по умолчанию (если пользователь не выбрал самооценку)
export const DEFAULT_LEVEL: PlacementCefrLevel = 'a2';

// Минимальная доля правильных ответов для зачёта уровня
export const LEVEL_ACCURACY_THRESHOLD = 0.6;

// Оценка словарного запаса по уровням
export const VOCAB_ESTIMATES: Record<PlacementCefrLevel, number> = {
  a1: 500,
  a2: 1500,
  b1: 3000,
  b2: 6000,
};

// Процентиль среди пользователей (примерный)
export const PERCENTILE_BY_LEVEL: Record<PlacementCefrLevel, number> = {
  a1: 20,
  a2: 45,
  b1: 70,
  b2: 90,
};

// TTL для in-memory сессий (15 минут)
export const SESSION_TTL_MS = 15 * 60 * 1000;
