/**
 * False Friends Quiz Service
 *
 * Квиз по ложным друзьям переводчика.
 * Показывает английское слово → 4 варианта (правильный перевод + ложный друг + 2 дистрактора).
 */

import { FALSE_FRIENDS, type FalseFriend } from '../../data/false-friends.js';

// Per-user rotation tracking (in-memory)
const userLastIndex = new Map<number, number>();

type FalseFriendQuestion = {
  word: string;
  options: string[];
  correctAnswer: string;
  wrongFriend: string;
  example: string;
  exampleRu: string;
  questionIndex: number;
};

type FalseFriendAnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  wrongFriend: string;
  explanation: string;
};

/**
 * Генерирует следующий вопрос по ложным друзьям.
 */
export function getNextFalseFriendQuestion(userId: number): {
  question: FalseFriendQuestion;
  questionIndex: number;
} {
  const lastIdx = userLastIndex.get(userId) ?? -1;
  const nextIdx = (lastIdx + 1) % FALSE_FRIENDS.length;
  userLastIndex.set(userId, nextIdx);

  const item = FALSE_FRIENDS[nextIdx]!;
  const options = generateOptions(item, nextIdx);

  return {
    question: {
      word: item.word,
      options,
      correctAnswer: item.correctRu,
      wrongFriend: item.wrongRu,
      example: item.example,
      exampleRu: item.exampleRu,
      questionIndex: nextIdx,
    },
    questionIndex: nextIdx,
  };
}

/**
 * Проверяет ответ на вопрос по ложным друзьям.
 */
export function checkFalseFriendAnswer(
  questionIndex: number,
  answer: string,
): FalseFriendAnswerResult {
  const item = FALSE_FRIENDS[questionIndex];
  if (!item) {
    return {
      isCorrect: false,
      correctAnswer: '',
      wrongFriend: '',
      explanation: 'Вопрос не найден',
    };
  }

  const isCorrect = answer === item.correctRu;

  return {
    isCorrect,
    correctAnswer: item.correctRu,
    wrongFriend: item.wrongRu,
    explanation: isCorrect
      ? `Верно! "${item.word}" = ${item.correctRu} (не ${item.wrongRu})`
      : `"${item.word}" ≠ ${item.wrongRu}! Правильно: ${item.correctRu}`,
  };
}

/**
 * Генерирует 4 варианта ответа: правильный + ложный друг + 2 случайных.
 */
function generateOptions(item: FalseFriend, itemIndex: number): string[] {
  const options = new Set<string>();
  options.add(item.correctRu);
  options.add(item.wrongRu);

  // Добавляем 2 случайных дистрактора из других false friends
  const otherItems = FALSE_FRIENDS.filter((_, i) => i !== itemIndex);
  const shuffled = otherItems.sort(() => Math.random() - 0.5);

  for (const other of shuffled) {
    if (options.size >= 4) break;
    if (!options.has(other.correctRu)) {
      options.add(other.correctRu);
    }
    if (options.size >= 4) break;
    if (!options.has(other.wrongRu)) {
      options.add(other.wrongRu);
    }
  }

  // Перемешиваем
  return [...options].sort(() => Math.random() - 0.5);
}
