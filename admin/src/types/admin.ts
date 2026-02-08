export type GeneralStats = {
  totalUsers: number;
  activeToday: number;
  activeWeek: number;
  totalQuizzes: number;
  totalDuels: number;
  avgStreak: string;
};

export type TimeSeriesPoint = { date: string; count: number };

export type RetentionData = {
  cohortSize: number;
  retained: number;
  rate: number;
};

export type ActivityStats = {
  dau: TimeSeriesPoint[];
  wau: TimeSeriesPoint[];
  mau: TimeSeriesPoint[];
  registrations: TimeSeriesPoint[];
  retention: Record<string, RetentionData>;
};

export type EconomyStats = {
  totalGems: number;
  avgGems: string;
  totalFreezes: number;
  gemsDistribution: Array<{ bucket: string; count: number }>;
};

export type SrsStats = {
  totalLearned: number;
  avgLearnedPerUser: string;
  stageDistribution: Array<{ stage: number; count: number }>;
  accuracy: number;
  totalAnswers: number;
  correctAnswers: number;
  wordsWithPenalty: number;
  customWordsTotal: number;
};

export type AdminUser = {
  id: number;
  telegramId: string;
  firstName: string;
  username: string | null;
  level: number;
  xp: number;
  gems: number;
  streakDays: number;
  createdAt: string;
  lastActivityAt: string | null;
  leagueTier: string;
  wordsLearned: number;
  quizzesCompleted: number;
  correctPercent: number;
};

export type UsersListResponse = {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type UserDetailResponse = {
  user: {
    id: number;
    telegramId: string;
    firstName: string;
    username: string | null;
    xp: number;
    level: number;
    gems: number;
    streakDays: number;
    maxStreakDays: number;
    bestAnswerStreak: number;
    streakFreezes: number;
    createdAt: string;
    lastActivityAt: string | null;
  };
  league: { tier: string; division: number };
  quizStats: {
    totalSessions: number;
    totalCorrect: number;
    totalQuestions: number;
    totalXp: number;
    correctPercent: number;
  };
  wordsLearned: number;
  wordsInProgress: number;
  userStages: Array<{ stage: number; count: number }>;
  duelStats: { total: number; won: number };
};

export type QuizSession = {
  id: number;
  type: string;
  score: number;
  correctCount: number;
  totalCount: number;
  xpEarned: number;
  startedAt: string;
  finishedAt: string | null;
};

export type UserActivityResponse = {
  sessions: QuizSession[];
  streakHistory: Array<{ date: string; type: string }>;
};

export type UserWord = {
  id: number;
  srsStage: number;
  correctCount: number;
  incorrectCount: number;
  hasPenalty: boolean;
  masteredAt: string | null;
  lastSeenAt: string;
  wordText: string;
  translation: string;
  partOfSpeech: string;
};

export type UserWordsResponse = {
  words: UserWord[];
};

export type AdminInfo = {
  telegramId: string;
  firstName: string;
  username?: string;
  photoUrl?: string;
};
