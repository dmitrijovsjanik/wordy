// Интервалы в часах для каждого перехода этапа
const SRS_INTERVALS_HOURS = [4, 24, 72, 168, 336, 720]; // 4ч, 1д, 3д, 7д, 14д, 30д

export const MASTERED_STAGE = 6;
const WRONG_ANSWER_DROP = 2;
const MASTERED_REVIEW_DAYS = 90;
const WRONG_ANSWER_COOLDOWN_MIN = 30;

type SrsResult = {
  newStage: number;
  nextReviewAt: Date;
  isMastered: boolean;
};

export function computeNextReview(currentStage: number, isCorrect: boolean): SrsResult {
  const now = new Date();

  if (!isCorrect) {
    const newStage = currentStage - WRONG_ANSWER_DROP; // может быть отрицательным
    return {
      newStage,
      nextReviewAt: new Date(now.getTime() + WRONG_ANSWER_COOLDOWN_MIN * 60 * 1000),
      isMastered: false,
    };
  }

  const newStage = currentStage + 1;

  if (newStage >= MASTERED_STAGE) {
    return {
      newStage: MASTERED_STAGE,
      nextReviewAt: new Date(now.getTime() + MASTERED_REVIEW_DAYS * 24 * 60 * 60 * 1000),
      isMastered: true,
    };
  }

  // Для отрицательных/нулевых этапов используем первый интервал
  const intervalIndex = Math.max(0, currentStage);
  const intervalHours = SRS_INTERVALS_HOURS[intervalIndex] ?? SRS_INTERVALS_HOURS[0]!;
  return {
    newStage,
    nextReviewAt: new Date(now.getTime() + intervalHours * 60 * 60 * 1000),
    isMastered: false,
  };
}
