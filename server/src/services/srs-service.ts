// Интервалы фазы обучения (часы): после 1→2 ответа, после 2→3 ответа
const LEARNING_INTERVALS_HOURS = [4, 8];

// Интервалы фазы повторения (дни): после изучения (3/3)
const REVIEW_INTERVALS_DAYS = [3, 7, 21, 60, 180];

const WRONG_ANSWER_COOLDOWN_MIN = 30;
const WRONG_REVIEW_RESET_DAYS = 1;

export const LEARNED_PROGRESS = 3; // meaning считается изученным после 3 правильных ответов

type SrsState = {
  learningProgress: number; // 0-3
  hasPenalty: boolean;
  reviewStage: number; // 0-4, индекс в REVIEW_INTERVALS_DAYS
};

type SrsResult = {
  newProgress: number;
  newPenalty: boolean;
  newReviewStage: number;
  nextReviewAt: Date;
  isLearned: boolean; // true когда learningProgress достигает 3 впервые
};

export function computeNextReview(state: SrsState, isCorrect: boolean): SrsResult {
  const now = new Date();

  // ── Фаза обучения (progress < 3) ──
  if (state.learningProgress < LEARNED_PROGRESS) {
    if (!isCorrect) {
      // Ошибка: ставим штраф, 30 мин кулдаун, прогресс НЕ откатывается
      return {
        newProgress: state.learningProgress,
        newPenalty: true,
        newReviewStage: 0,
        nextReviewAt: new Date(now.getTime() + WRONG_ANSWER_COOLDOWN_MIN * 60 * 1000),
        isLearned: false,
      };
    }

    if (state.hasPenalty) {
      // Правильно, но штраф активен: гасим штраф, прогресс не двигаем
      const intervalIndex = Math.min(state.learningProgress, LEARNING_INTERVALS_HOURS.length - 1);
      return {
        newProgress: state.learningProgress,
        newPenalty: false,
        newReviewStage: 0,
        nextReviewAt: new Date(now.getTime() + LEARNING_INTERVALS_HOURS[intervalIndex]! * 60 * 60 * 1000),
        isLearned: false,
      };
    }

    // Правильно, без штрафа: двигаем прогресс
    const newProgress = state.learningProgress + 1;
    const isLearned = newProgress >= LEARNED_PROGRESS;

    if (isLearned) {
      // Выучено! Первое повторение через 3 дня
      return {
        newProgress: LEARNED_PROGRESS,
        newPenalty: false,
        newReviewStage: 0,
        nextReviewAt: new Date(now.getTime() + REVIEW_INTERVALS_DAYS[0]! * 24 * 60 * 60 * 1000),
        isLearned: true,
      };
    }

    // Прогресс 0→1 или 1→2: интервал из LEARNING_INTERVALS_HOURS
    const intervalIndex = Math.min(state.learningProgress, LEARNING_INTERVALS_HOURS.length - 1);
    return {
      newProgress,
      newPenalty: false,
      newReviewStage: 0,
      nextReviewAt: new Date(now.getTime() + LEARNING_INTERVALS_HOURS[intervalIndex]! * 60 * 60 * 1000),
      isLearned: false,
    };
  }

  // ── Фаза повторения (progress == 3) ──
  if (!isCorrect) {
    // Ошибка на повторении: сброс интервала на 1 день, прогресс НЕ откатывается
    return {
      newProgress: LEARNED_PROGRESS,
      newPenalty: false,
      newReviewStage: 0,
      nextReviewAt: new Date(now.getTime() + WRONG_REVIEW_RESET_DAYS * 24 * 60 * 60 * 1000),
      isLearned: false,
    };
  }

  // Правильно на повторении: следующий интервал
  const nextReviewStage = Math.min(state.reviewStage + 1, REVIEW_INTERVALS_DAYS.length - 1);
  const intervalDays = REVIEW_INTERVALS_DAYS[nextReviewStage]!;

  return {
    newProgress: LEARNED_PROGRESS,
    newPenalty: false,
    newReviewStage: nextReviewStage,
    nextReviewAt: new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000),
    isLearned: false,
  };
}
