import { TENSE_EXERCISES, type TenseExercise } from '../../data/tense-exercises.js';

const ALL_TENSES = [
  'present_simple',
  'present_continuous',
  'present_perfect',
  'present_perfect_continuous',
  'past_simple',
  'past_continuous',
  'past_perfect',
  'past_perfect_continuous',
  'future_simple',
  'future_going_to',
  'future_continuous',
  'future_perfect',
] as const;

// Track last used tenses per user for variety
const userTenseHistory = new Map<number, string[]>();
const TENSE_HISTORY_SIZE = 6;

function pickLeastRecentTense(userId: number): string {
  const history = userTenseHistory.get(userId) ?? [];
  const unused = ALL_TENSES.filter((t) => !history.includes(t));
  const pool = unused.length > 0 ? unused : ALL_TENSES;
  return pool[Math.floor(Math.random() * pool.length)];
}

function trackTense(userId: number, tense: string): void {
  const history = userTenseHistory.get(userId) ?? [];
  history.push(tense);
  if (history.length > TENSE_HISTORY_SIZE) {
    history.shift();
  }
  userTenseHistory.set(userId, history);
}

export function getNextTenseQuestion(
  userId: number,
  difficulty?: number,
): { exercise: TenseExercise; exerciseIndex: number } {
  // Filter by difficulty if specified
  let pool = difficulty
    ? TENSE_EXERCISES.filter((ex) => ex.difficulty === difficulty)
    : TENSE_EXERCISES;

  if (pool.length === 0) {
    pool = TENSE_EXERCISES;
  }

  // Pick a tense with rotation for variety
  const targetTense = pickLeastRecentTense(userId);

  // Try to find exercises in the target tense
  let tensePool = pool.filter((ex) => ex.tense === targetTense);

  // Fall back to full pool if no exercises match both filters
  if (tensePool.length === 0) {
    tensePool = pool;
  }

  // Pick random exercise
  const randomIdx = Math.floor(Math.random() * tensePool.length);
  const exercise = tensePool[randomIdx];

  // Find global index in TENSE_EXERCISES
  const exerciseIndex = TENSE_EXERCISES.indexOf(exercise);

  trackTense(userId, exercise.tense);

  return { exercise, exerciseIndex };
}

export function checkTenseAnswer(
  exerciseIndex: number,
  answer: string,
): {
  isCorrect: boolean;
  explanation: string;
  correctAnswer: string;
  tense: string;
  signalWords: string[];
} {
  const exercise = TENSE_EXERCISES[exerciseIndex];

  if (!exercise) {
    return {
      isCorrect: false,
      explanation: 'Упражнение не найдено.',
      correctAnswer: '',
      tense: '',
      signalWords: [],
    };
  }

  const normalizedAnswer = answer.trim();
  const isCorrect = normalizedAnswer === exercise.correctAnswer;

  return {
    isCorrect,
    explanation: exercise.explanation,
    correctAnswer: exercise.correctAnswer,
    tense: exercise.tense,
    signalWords: exercise.signalWords,
  };
}
