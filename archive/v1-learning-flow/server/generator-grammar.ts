// Grammar question generators — обёртки над существующими grammar services
// для встраивания грамматических вопросов в основной квиз

import { getNextArticleQuestion, checkArticleAnswer } from '../../grammar/article-service.js';
import { getNextTenseQuestion, checkTenseAnswer } from '../../grammar/tense-quiz-service.js';
import { getNextCollocation, checkCollocationAnswer } from './collocation.js';
import { getNextFalseFriendQuestion, checkFalseFriendAnswer } from '../../grammar/false-friends-service.js';
import { generateTenseMatchPairs, type TenseMatchPairsQuestion } from './tense-match-pairs.js';
import type { ArticleExercise } from '../../../data/article-exercises.js';
import type { TenseExercise } from '../../../data/tense-exercises.js';
import type { Collocation } from '../../../data/collocations.js';

// ─── Grammar Question Types ────────────────────────────────────────────────

export type GrammarType = 'grammar-article' | 'grammar-tense' | 'grammar-collocation' | 'grammar-false-friend' | 'grammar-tense-match';

export type GrammarArticleQuestion = {
  type: 'grammar-article';
  exercise: ArticleExercise;
  exerciseIndex: number;
};

export type GrammarTenseQuestion = {
  type: 'grammar-tense';
  exercise: TenseExercise;
  exerciseIndex: number;
};

export type GrammarCollocationQuestion = {
  type: 'grammar-collocation';
  collocation: Collocation;
  collocationIndex: number;
};

export type GrammarFalseFriendQuestion = {
  type: 'grammar-false-friend';
  word: string;
  options: string[];
  correctAnswer: string;
  wrongFriend: string;
  example: string;
  exampleRu: string;
  questionIndex: number;
};

export type GrammarQuestion =
  | GrammarArticleQuestion
  | GrammarTenseQuestion
  | GrammarCollocationQuestion
  | GrammarFalseFriendQuestion
  | TenseMatchPairsQuestion;

// ─── Настройки ──────────────────────────────────────────────────────────────

/** Грамматический вопрос каждые N вопросов (настраиваемо) */
export const GRAMMAR_EVERY_N = 5;

const GRAMMAR_TYPES: GrammarType[] = [
  'grammar-article',
  'grammar-tense',
  'grammar-collocation',
  'grammar-false-friend',
  'grammar-tense-match',
];

// ─── Generation ─────────────────────────────────────────────────────────────

/**
 * Генерирует грамматический вопрос, избегая повторов типов из recentGenerators.
 */
export function generateGrammarQuestion(
  userId: number,
  recentGenerators: string[],
): GrammarQuestion {
  // Избегаем повторения одного и того же типа грамматики подряд
  const recentGrammar = recentGenerators.filter(g => g.startsWith('grammar-'));
  const lastGrammar = recentGrammar[recentGrammar.length - 1];
  const available = GRAMMAR_TYPES.filter(t => t !== lastGrammar);
  const pool = available.length > 0 ? available : GRAMMAR_TYPES;
  const type = pool[Math.floor(Math.random() * pool.length)]!;

  switch (type) {
    case 'grammar-article': {
      const { exercise, exerciseIndex } = getNextArticleQuestion(userId);
      return { type: 'grammar-article', exercise, exerciseIndex };
    }
    case 'grammar-tense': {
      const { exercise, exerciseIndex } = getNextTenseQuestion(userId);
      return { type: 'grammar-tense', exercise, exerciseIndex };
    }
    case 'grammar-collocation': {
      const { collocation, collocationIndex } = getNextCollocation();
      return { type: 'grammar-collocation', collocation, collocationIndex };
    }
    case 'grammar-false-friend': {
      const { question, questionIndex } = getNextFalseFriendQuestion(userId);
      return {
        type: 'grammar-false-friend',
        word: question.word,
        options: question.options,
        correctAnswer: question.correctAnswer,
        wrongFriend: question.wrongFriend,
        example: question.example,
        exampleRu: question.exampleRu,
        questionIndex,
      };
    }
    case 'grammar-tense-match': {
      return generateTenseMatchPairs(2);
    }
  }
}

// ─── Answer Checking ────────────────────────────────────────────────────────

export type GrammarAnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
};

export function checkGrammarAnswer(
  type: GrammarType,
  params: {
    exerciseIndex?: number;
    blankIndex?: number;
    collocationIndex?: number;
    questionIndex?: number;
    answer: string;
  },
): GrammarAnswerResult {
  switch (type) {
    case 'grammar-article': {
      const result = checkArticleAnswer(params.exerciseIndex!, params.blankIndex ?? 0, params.answer);
      return {
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
      };
    }
    case 'grammar-tense': {
      const result = checkTenseAnswer(params.exerciseIndex!, params.answer);
      return {
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
      };
    }
    case 'grammar-collocation': {
      const result = checkCollocationAnswer(params.collocationIndex!, params.answer);
      return {
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
      };
    }
    case 'grammar-false-friend': {
      const result = checkFalseFriendAnswer(params.questionIndex!, params.answer);
      return {
        isCorrect: result.isCorrect,
        correctAnswer: result.correctAnswer,
        explanation: result.explanation,
      };
    }
    case 'grammar-tense-match': {
      // Tense match-pairs: клиент отправляет 'correct'/'incorrect' по результату
      return { isCorrect: params.answer === 'correct', correctAnswer: '' };
    }
  }
}
