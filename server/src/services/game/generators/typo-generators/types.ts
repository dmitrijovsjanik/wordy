// ─── Typo Types ──────────────────────────────────────────────────────────────

/**
 * Тип опечатки для отладки и аналитики
 */
export type TypoType =
  | 'double-simplify'      // Упрощение удвоенной буквы: ll→l
  | 'phonetic-vowel'       // Замена гласной: ea→ee
  | 'phonetic-consonant'   // Замена согласной: ph→f
  | 'phonetic-ending'      // Замена окончания: tion→shun
  | 'transposition'        // Перестановка букв: team→taem
  | 'suffix'               // Ошибка в суффиксе: -ful→-full
  | 'silent-remove'        // Удаление немой буквы: knight→night
  | 'silent-add';          // Добавление немой буквы: night→knight

/**
 * Результат генерации одной опечатки
 */
export type TypoResult = {
  variant: string;       // Сгенерированный вариант (например, "teem")
  type: TypoType;        // Тип опечатки
  confidence: number;    // 0-1, насколько правдоподобна опечатка
};

/**
 * Контекст генерации — передаётся всем подгенераторам
 */
export type TypoGeneratorContext = {
  word: string;          // Исходное слово ("team")
  maxVariants: number;   // Максимум вариантов от этого генератора
  seed?: number;         // Опциональный seed для детерминизма
};

/**
 * Интерфейс подгенератора опечаток
 */
export interface TypoGenerator {
  /**
   * Уникальный идентификатор генератора
   */
  readonly id: string;

  /**
   * Приоритет (выше = чаще используется в комбинаторе)
   * Диапазон: 1-10
   */
  readonly priority: number;

  /**
   * Генерирует варианты опечаток для слова
   * @returns Массив вариантов, отсортированный по confidence DESC
   */
  generate(ctx: TypoGeneratorContext): TypoResult[];
}

/**
 * Конфигурация комбинатора
 */
export type CombinatorConfig = {
  totalVariants?: number;      // Сколько вариантов нужно (default: 5)
  filterRealWords?: boolean;   // Исключать реальные слова (default: false)
  seed?: number;               // Seed для воспроизводимости
};

// ─── Axis Types (для 2-осевой генерации) ─────────────────────────────────────

/**
 * Ось путаницы — конкретная точка в слове с двумя вариантами написания
 * Используется для 2x2 матрицы: 4 варианта из комбинации 2 осей
 */
export type Axis = {
  start: number;       // Позиция начала в слове
  end: number;         // Позиция конца (exclusive)
  correct: string;     // Верные символы (из оригинала)
  wrong: string;       // Ошибочная замена
  confidence: number;  // 0-1
  type: string;        // Для отладки ('phonetic', 'double', 'suffix', 'silent-e', 'vowel')
};
