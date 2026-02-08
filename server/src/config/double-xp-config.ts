/**
 * Double XP Timer Configuration
 *
 * 10% шанс на каждый вопрос активировать раунд с удвоенным XP.
 * Игрок должен ответить правильно в пределах таймлимита.
 */

export const DOUBLE_XP_CHANCE = 0.10;
export const DOUBLE_XP_MULTIPLIER = 2;
export const DOUBLE_XP_GRACE_MS = 2000; // запас на сетевую задержку

export const DOUBLE_XP_TIME_LIMITS: Record<string, number> = {
  'multiple-choice': 4000,
  'spelling': 6000,
  'match-pairs': 8000,
};
