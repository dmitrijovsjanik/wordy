/**
 * Reading Service
 *
 * Per-user rotation service for extensive reading passages.
 * Tracks which passage each user has seen and serves the next one.
 */

import { READING_PASSAGES, type ReadingPassage, type ReadingQuestion } from '../../data/reading-passages.js';

// Per-user rotation tracking (in-memory), keyed by `${userId}:${level || 'all'}`
const userLastIndex = new Map<string, number>();

/** Passage format sent to client — correctIndex stripped from questions */
type QuestionForClient = Omit<ReadingQuestion, 'correctIndex'>;

type PassageForClient = Omit<ReadingPassage, 'questions'> & {
  questions: QuestionForClient[];
};

type NextPassageResult = {
  passage: PassageForClient;
  passageIndex: number;
};

type AnswerResult = {
  isCorrect: boolean;
  correctIndex: number;
};

function getFilteredPassages(level?: string): ReadingPassage[] {
  if (!level) return READING_PASSAGES;
  const upper = level.toUpperCase();
  const filtered = READING_PASSAGES.filter((p) => p.level === upper);
  return filtered.length > 0 ? filtered : READING_PASSAGES;
}

function stripCorrectIndex(passage: ReadingPassage): PassageForClient {
  return {
    ...passage,
    questions: passage.questions.map(({ question, questionRu, options }) => ({
      question,
      questionRu,
      options,
    })),
  };
}

function getUserKey(userId: number, level?: string): string {
  return `${userId}:${level?.toUpperCase() ?? 'all'}`;
}

/**
 * Returns the next reading passage for the user.
 * Strips correctIndex from questions before sending to client.
 */
export function getNextPassage(userId: number, level?: string): NextPassageResult {
  const passages = getFilteredPassages(level);
  const key = getUserKey(userId, level);

  const lastIdx = userLastIndex.get(key) ?? -1;
  const nextIdx = (lastIdx + 1) % passages.length;
  userLastIndex.set(key, nextIdx);

  const passage = passages[nextIdx]!;

  return {
    passage: stripCorrectIndex(passage),
    passageIndex: nextIdx,
  };
}

/**
 * Checks the user's answer for a specific question in a passage.
 */
export function checkAnswer(
  passageIndex: number,
  questionIndex: number,
  answerIndex: number,
  level?: string,
): AnswerResult {
  const passages = getFilteredPassages(level);
  const passage = passages[passageIndex];

  if (!passage) {
    return { isCorrect: false, correctIndex: -1 };
  }

  const question = passage.questions[questionIndex];

  if (!question) {
    return { isCorrect: false, correctIndex: -1 };
  }

  return {
    isCorrect: answerIndex === question.correctIndex,
    correctIndex: question.correctIndex,
  };
}
