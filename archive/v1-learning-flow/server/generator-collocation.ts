/**
 * Collocation Generator
 *
 * Standalone quiz generator для раздела грамматики.
 * НЕ интегрирован в основную ротацию квизов — используется отдельно.
 */

import { COLLOCATIONS, type Collocation } from '../../../data/collocations.js';
import { shuffle } from './multiple-choice.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type CollocationQuestion = {
  collocation: Collocation;
  collocationIndex: number;
};

export type CollocationAnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  translation: string;
};

// ─── Generator ──────────────────────────────────────────────────────────────

/**
 * Возвращает случайную коллокацию с учётом сложности.
 * Если difficulty не указан — выбирает из всех.
 */
export function getNextCollocation(difficulty?: number): CollocationQuestion {
  const candidates = difficulty
    ? COLLOCATIONS.filter((c) => c.difficulty === difficulty)
    : COLLOCATIONS;

  if (candidates.length === 0) {
    // Fallback: если пустой фильтр — берём из всех
    const idx = Math.floor(Math.random() * COLLOCATIONS.length);
    const collocation = COLLOCATIONS[idx]!;
    return {
      collocation: {
        ...collocation,
        options: shuffle(collocation.options),
      },
      collocationIndex: idx,
    };
  }

  const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)]!;
  const globalIndex = COLLOCATIONS.indexOf(randomCandidate);

  return {
    collocation: {
      ...randomCandidate,
      options: shuffle(randomCandidate.options),
    },
    collocationIndex: globalIndex,
  };
}

// ─── Answer Checking ────────────────────────────────────────────────────────

/**
 * Проверяет ответ пользователя на коллокацию.
 */
export function checkCollocationAnswer(
  collocationIndex: number,
  answer: string,
): CollocationAnswerResult {
  const collocation = COLLOCATIONS[collocationIndex];

  if (!collocation) {
    return {
      isCorrect: false,
      correctAnswer: '',
      translation: '',
    };
  }

  return {
    isCorrect: answer.toLowerCase() === collocation.correctAnswer.toLowerCase(),
    correctAnswer: collocation.correctAnswer,
    translation: collocation.translation,
  };
}
