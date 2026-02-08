// Лимиты бесплатного плана
export const FREE_LIMITS = {
  MAX_CUSTOM_COLLECTIONS: 1,
  MAX_WORDS_PER_COLLECTION: 50,
} as const;

// Длительность Premium в миллисекундах
export const PREMIUM_DURATIONS = {
  month: 30 * 24 * 60 * 60 * 1000,
  year: 365 * 24 * 60 * 60 * 1000,
} as const;
