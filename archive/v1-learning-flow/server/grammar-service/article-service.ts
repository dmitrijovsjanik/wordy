import { ARTICLE_EXERCISES, type ArticleExercise, type RuleCategory } from '../../data/article-exercises.js';

// Track last used category per user to ensure variety
const userCategoryHistory = new Map<number, RuleCategory[]>();
const CATEGORY_HISTORY_SIZE = 5;

const ALL_CATEGORIES: RuleCategory[] = [
  'first_mention',
  'unique',
  'zero_article',
  'a_vs_an',
  'fixed_expressions',
  'general_plural',
  'uncountable',
  'superlative',
  'ordinal',
];

function pickLeastRecentCategory(userId: number): RuleCategory {
  const history = userCategoryHistory.get(userId) ?? [];

  // Find categories not in recent history
  const unused = ALL_CATEGORIES.filter((cat) => !history.includes(cat));
  const pool = unused.length > 0 ? unused : ALL_CATEGORIES;

  return pool[Math.floor(Math.random() * pool.length)];
}

function trackCategory(userId: number, category: RuleCategory): void {
  const history = userCategoryHistory.get(userId) ?? [];
  history.push(category);
  if (history.length > CATEGORY_HISTORY_SIZE) {
    history.shift();
  }
  userCategoryHistory.set(userId, history);
}

export function getNextArticleQuestion(
  userId: number,
  difficulty?: number,
): { exercise: ArticleExercise; exerciseIndex: number } {
  // Filter by difficulty if specified
  let pool = difficulty
    ? ARTICLE_EXERCISES.filter((ex) => ex.difficulty === difficulty)
    : ARTICLE_EXERCISES;

  if (pool.length === 0) {
    pool = ARTICLE_EXERCISES;
  }

  // Pick a category with rotation to ensure variety
  const targetCategory = pickLeastRecentCategory(userId);

  // Try to find exercises in the target category
  let categoryPool = pool.filter((ex) => ex.ruleCategory === targetCategory);

  // If no exercises match both filters, fall back to full pool
  if (categoryPool.length === 0) {
    categoryPool = pool;
  }

  // Pick random exercise from the filtered pool
  const randomIdx = Math.floor(Math.random() * categoryPool.length);
  const exercise = categoryPool[randomIdx];

  // Find the global index in ARTICLE_EXERCISES
  const exerciseIndex = ARTICLE_EXERCISES.indexOf(exercise);

  trackCategory(userId, exercise.ruleCategory);

  return { exercise, exerciseIndex };
}

export function checkArticleAnswer(
  exerciseIndex: number,
  blankIndex: number,
  answer: string,
): { isCorrect: boolean; explanation: string; correctAnswer: string } {
  const exercise = ARTICLE_EXERCISES[exerciseIndex];

  if (!exercise) {
    return {
      isCorrect: false,
      explanation: 'Exercise not found.',
      correctAnswer: '',
    };
  }

  const blank = exercise.blanks[blankIndex];

  if (!blank) {
    return {
      isCorrect: false,
      explanation: 'Blank not found.',
      correctAnswer: '',
    };
  }

  const normalizedAnswer = answer.trim().toLowerCase();
  const isCorrect = normalizedAnswer === blank.correctAnswer;

  return {
    isCorrect,
    explanation: blank.explanation,
    correctAnswer: blank.correctAnswer,
  };
}
