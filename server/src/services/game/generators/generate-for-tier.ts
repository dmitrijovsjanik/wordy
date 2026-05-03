import { learningConfig, type ExerciseType } from '../../../config/learning-config.js';
import type { LearningTier } from '../../analytics-service.js';
import type {
  PooledMeaning,
  LegacyQuestion,
  ListeningQuestion,
  DictationQuestion,
  FreeRecallQuestion,
  ClozeQuestion,
  EncounterCardQuestion,
  PassiveRecallCardQuestion,
  GeneratorType,
} from '../types.js';
import { generateEncounterCard } from './encounter.js';
import { generatePassiveRecallFromMeaning } from './passive-recall.js';
import { generateFromMeaning } from './multiple-choice.js';
import { generateFreeRecallFromMeaning } from './free-recall.js';
import { generateListeningFromMeaning } from './listening.js';
import { generateDictationFromMeaning, canGenerateDictation } from './dictation.js';
import { canGenerateCloze, generateClozeFromMeaning } from './cloze.js';

/**
 * Универсальный отбор упражнения для текущего tier'а на лестнице.
 *
 * Принцип работы:
 *   1. Берём `learningConfig.tiers[tier].allowedExerciseTypes`.
 *   2. Фильтруем те, что нельзя сгенерить для конкретного meaning (cloze без AI-content, dictation на коротких словах).
 *   3. Простой anti-repeat: исключаем тип, использованный последним из recentGenerators.
 *   4. Берём случайный из оставшихся → вызываем генератор → возвращаем Question.
 *   5. Fallback: если выбранный генератор вернул null/упал, идём по списку в порядке fallback-приоритета.
 *
 * Match-pairs здесь не поддерживается — он работает на пуле (несколько слов),
 * не на одном meaning. Останется отдельным режимом, доступным через старый /api/quiz/next.
 */

export type TierQuestion =
  | EncounterCardQuestion
  | PassiveRecallCardQuestion
  | LegacyQuestion
  | ListeningQuestion
  | DictationQuestion
  | FreeRecallQuestion
  | ClozeQuestion;

export type GenerateForTierOpts = {
  /** Последние использованные generator-типы (для anti-repeat). */
  recentGenerators?: string[];
};

/** Маппинг ExerciseType → GeneratorType (для рекорда в recentGenerators). */
function exerciseToGeneratorType(ex: ExerciseType): GeneratorType {
  if (ex === 'encounter-card') return 'encounter';
  if (ex === 'passive-recall-card') return 'passive-recall';
  if (ex === 'multiple-choice') return 'en-ru'; // multiple-choice пишется как en-ru/ru-en в recentGenerators
  if (ex === 'free-recall') return 'free-recall';
  if (ex === 'dictation') return 'dictation';
  if (ex === 'listening') return 'listening';
  if (ex === 'cloze') return 'cloze';
  if (ex === 'spelling') return 'spelling';
  if (ex === 'match-pairs') return 'match-pairs';
  return 'en-ru';
}

async function tryGenerate(
  exercise: ExerciseType,
  meaning: PooledMeaning,
): Promise<TierQuestion | null> {
  try {
    if (exercise === 'encounter-card') {
      return await generateEncounterCard(meaning);
    }
    if (exercise === 'passive-recall-card') {
      return await generatePassiveRecallFromMeaning(meaning);
    }
    if (exercise === 'multiple-choice') {
      return await generateFromMeaning(meaning);
    }
    if (exercise === 'free-recall') {
      // В learning-flow free-recall всегда ru→en (единственный формат на
      // active/production/review). Случайное направление было только в legacy
      // /api/quiz; там фикс не нужен.
      return generateFreeRecallFromMeaning(meaning, { direction: 'ru-en' });
    }
    if (exercise === 'listening') {
      return await generateListeningFromMeaning(meaning);
    }
    if (exercise === 'dictation') {
      if (!canGenerateDictation(meaning.word.text)) return null;
      return generateDictationFromMeaning(meaning);
    }
    if (exercise === 'cloze') {
      if (!canGenerateCloze(meaning)) return null;
      return await generateClozeFromMeaning(meaning);
    }
    // spelling и match-pairs не поддерживаются в новой лестнице (отдельные режимы).
    return null;
  } catch {
    return null;
  }
}

export type GenerateForTierResult = {
  question: TierQuestion;
  generatorType: GeneratorType;
} | null;

export async function generateForTier(
  meaning: PooledMeaning,
  tier: LearningTier,
  opts: GenerateForTierOpts = {},
): Promise<GenerateForTierResult> {
  const cfg = learningConfig.tiers[tier];
  if (!cfg.enabled) {
    return null;
  }

  // Encounter — единственный обязательный путь.
  if (tier === 'encounter') {
    const q = await tryGenerate('encounter-card', meaning);
    return q ? { question: q, generatorType: 'encounter' } : null;
  }

  const allowed = [...cfg.allowedExerciseTypes];
  const lastUsed = opts.recentGenerators?.[opts.recentGenerators.length - 1];

  // Простая anti-repeat: исключаем последний использованный тип, если он есть в allowed.
  let candidates = allowed.filter(ex => exerciseToGeneratorType(ex) !== lastUsed);
  if (candidates.length === 0) candidates = allowed;

  // Перемешиваем и пробуем по порядку.
  const shuffled = candidates.slice().sort(() => Math.random() - 0.5);
  for (const ex of shuffled) {
    const q = await tryGenerate(ex, meaning);
    if (q) return { question: q, generatorType: exerciseToGeneratorType(ex) };
  }

  // Без fallback'а на multiple-choice — на главной экране НЕ должно быть
  // квиз-форматов (по требованию). Если все разрешённые типы для tier'а
  // не сгенерились (что не должно случаться для free-recall) — вернуть null.
  return null;
}
