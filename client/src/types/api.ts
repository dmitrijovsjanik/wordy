export type User = {
  id: number;
  firstName: string;
  username: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  streakDays: number;
  streakFreezes: number;
  gems: number;
  nativeLanguage: string;
  learningLanguage: string;
  repeatMastered: boolean;
  premiumUntil: string | null;
  premiumPlan: string | null;
  autoRenew: boolean;
  lastActivityAt: string | null;
  createdAt: string;
  estimatedCefr: CefrLevel | null;
  onboardingCompletedAt: string | null;
};

export type AuthResponse = {
  token: string;
  user: {
    id: number;
    firstName: string;
    username: string | null;
    level: number;
    xp: number;
  };
};

export type QuizQuestionBase = {
  type?: 'multiple-choice' | 'spelling'; // Тип вопроса (по умолчанию multiple-choice для совместимости)
  meaningId: number;
  word: string;
  originalForm: string | null; // Оригинальная форма если word — лемма (shoes при word=shoe)
  transcription: string | null;
  correctTranslation?: string; // Для multiple-choice
  correctSpelling?: string; // Для spelling
  options: string[];
  direction: string;
  doubleXpTimeLimitMs?: number;
};

export type MatchPairsApiQuestion = {
  type: 'match-pairs';
  pairs: Array<{ meaningId: number; word: string; translation: string }>;
  doubleXpTimeLimitMs?: number;
};

// Cloze question (заполни пропуск в предложении)
export type ClozeApiQuestion = {
  type: 'cloze';
  meaningId: number;
  sentence: string;
  sentenceRu: string;
  options: string[];
  correctAnswer: string;
  word: string;
  transcription: string | null;
  doubleXpTimeLimitMs?: number;
};

// Listening question (слушай → выбери перевод)
export type ListeningApiQuestion = {
  type: 'listening';
  meaningId: number;
  audioWord: string;
  transcription: string | null;
  options: string[];
  correctAnswer: string;
  doubleXpTimeLimitMs?: number;
};

// Dictation question (слушай → напиши)
export type DictationApiQuestion = {
  type: 'dictation';
  meaningId: number;
  audioWord: string;
  hint: string;
  correctAnswer: string;
  acceptableAnswers: string[];
  doubleXpTimeLimitMs?: number;
};

// Free Recall question (напиши перевод без вариантов)
export type FreeRecallApiQuestion = {
  type: 'free-recall';
  meaningId: number;
  direction: 'en-ru' | 'ru-en';
  prompt: string;
  transcription: string | null;
  audioWord?: string;
  acceptableAnswers: string[];
  doubleXpTimeLimitMs?: number;
};

export type QuizQuestion =
  | QuizQuestionBase
  | MatchPairsApiQuestion
  | ClozeApiQuestion
  | ListeningApiQuestion
  | DictationApiQuestion
  | FreeRecallApiQuestion;

export type QuizStartResponse = {
  sessionId: number;
  question: QuizQuestion | null;
};

export type QuizAnswerRequest = {
  sessionId: number;
  meaningId: number;
  selectedMeaningId: number | null;
  answerTimeMs: number;
};

export type QuizAnswerResponse = {
  isCorrect: boolean;
  correctTranslation: string;
  isFinished: boolean;
  nextQuestion: QuizQuestion | null;
};

export type QuizResultResponse = {
  correctCount: number;
  totalCount: number;
  xpEarned: number;
  streak: number;
  totalXp: number;
  level: number;
};

export type DuelSession = {
  correctCount: number;
  totalCount: number;
  score: number;
  finishedAt: string | null;
};

export type DuelPlayer = {
  id: number;
  firstName: string;
  username: string | null;
  avatarUrl: string | null;
};

export type Duel = {
  id: number;
  challengerId: number;
  opponentId: number | null;
  status: 'waiting' | 'active' | 'finished' | 'cancelled';
  winnerId: number | null;
  challengerSessionId: number;
  opponentSessionId: number | null;
  challenger: DuelPlayer;
  opponent: DuelPlayer | null;
  challengerSession: DuelSession;
  opponentSession: DuelSession | null;
  createdAt: string;
  updatedAt: string;
};

export type DuelCreateResponse = {
  id: number;
  challengerId: number;
  opponentId: null;
  status: 'waiting';
  winnerId: null;
  challengerSessionId: number;
  opponentSessionId: null;
  createdAt: string;
  updatedAt: string;
};

export type DuelFinishResponse = {
  winnerId: number | null;
};

export type UserStats = {
  totalGames: number;
  totalCorrect: number;
  totalQuestions: number;
  correctPercent: number;
  bestAnswerStreak: number;
  maxStreakDays: number;
  maxLeagueTier: LeagueTier | null;
  wordsLearned: number;
};

export type ApiError = {
  error: string;
  code: string;
};

// ─── Collections ────────────────────────────────────────────────────────────

export type CefrLevel = 'a1' | 'a2' | 'b1' | 'b2' | 'c1';

export type Collection = {
  id: number;
  type: 'system' | 'user' | 'auto';
  title: string;
  description: string | null;
  iconName: string | null;
  cefrLevel: CefrLevel | null;
  totalWords: number;
  price: number | null;
};

export type MarketplaceCollection = Collection & {
  isInLibrary: boolean;
};

export type CollectionGroup = {
  key: string;
  title: string;
  collections: MarketplaceCollection[];
};

export type LibraryCollection = Collection & {
  isActive: boolean;
  addedAt: string | null;
  masteredWords: number;
};

export type CollectionWord = {
  id: number;
  word: string;
  lemma?: string;
  transcription?: string;
  translation: string;
  alternativeTranslations?: string[];
  partOfSpeech: string;
  contextExample?: string;
  examples?: { text: string; translation: string }[];
  synonyms?: string[];
  meaningHints?: string[];
  frequency?: number;
  srsStage: number | null; // 0-3 learning progress, null = не встречалось
  popularityRank?: number;
};

export type CollectionDetail = {
  collection: Collection & { isInLibrary: boolean; isActive: boolean };
  words: CollectionWord[];
};

export type ErrorsCollectionMeta = {
  id: 'errors';
  type: 'auto';
  title: string;
  description: string;
  iconName: string;
};

export type DifficultWordsResponse = {
  totalWords: number;
  words: {
    meaningId: number;
    correctCount: number;
    incorrectCount: number;
    srsStage: number;
    word: string;
    translation: string;
  }[];
  collection: ErrorsCollectionMeta;
};

export type AllWordsResponse = {
  words: {
    id?: number;
    word: string;
    lemma?: string;
    transcription?: string;
    translation: string;
    alternativeTranslations?: string[];
    partOfSpeech?: string;
    srsStage?: number;
    popularityRank?: number;
  }[];
};

// ─── Dictionary ─────────────────────────────────────────────────────────────

export type DictionaryMeaning = {
  id: number | null;
  translation: string;
  partOfSpeech: string;
  examples: { text: string; translation: string }[];
  synonyms: string[];
};

export type DictionaryLookupResult = {
  word: string;
  transcription: string | null;
  lang: string;
  meanings: DictionaryMeaning[];
  savedToDb: boolean;
};

// ─── Infinite Quiz ──────────────────────────────────────────────────────────

export type InfiniteAnswerResponse = {
  isCorrect: boolean;
  correctTranslation: string;
  xpEarned: number;
  xpModifier?: number; // модификатор в процентах (100 = x1.0, 110 = x1.1)
  totalXp?: number;
  level?: number;
  levelUp?: number;
  lpEarned: number;
  lpModifier?: number; // модификатор в процентах (100 = x1.0, 105 = x1.05)
  totalLp?: number;
  gemsEarned?: number; // гемы за стрик ответов / level-up
  dailyCorrectCount?: number; // правильных ответов за день
  doubleXpApplied?: boolean;
  examples?: { en: string; ru: string }[]; // примеры предложений для глубокой обработки
  milestones?: MilestoneData[]; // достигнутые milestones
};

export type MilestoneData = {
  id: string;
  type: string;
  threshold: number;
  title: string;
  description: string;
  gemsReward: number;
  icon: string;
};

// ─── CEFR Progress ─────────────────────────────────────────────────────────

export type CefrProgressLevel = {
  level: CefrLevel;
  totalWords: number;
  learnedWords: number;
  percent: number;
};

export type CefrProgressResponse = {
  levels: CefrProgressLevel[];
};

export type MatchPairsAnswerResponse = {
  correctCount: number;
  totalCount: number;
  totalXpEarned: number;
  xpModifier?: number;
  totalLpEarned: number;
  lpModifier?: number;
  totalXp?: number;
  totalLp?: number;
  level?: number;
  levelUp?: number;
  gemsEarned?: number;
  doubleXpApplied?: boolean;
};

// ─── Leagues ─────────────────────────────────────────────────────────────────

export type LeagueTier =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'amber'
  | 'sapphire'
  | 'amethyst'
  | 'topaz'
  | 'ruby'
  | 'legend';

export type UserLeagueProgress = {
  tier: LeagueTier;
  division: number;
};

export type LeagueSeason = {
  id: number;
  weekNumber: number;
  year: number;
  startedAt: string;
  endedAt: string | null;
  isActive: boolean;
};

export type UserSeasonStats = {
  leaguePoints: number;
  correctAnswers: number;
  quizzesCompleted: number;
  duelsWon: number;
  streakBonus: number;
};

export type LeaderboardEntry = {
  userId: number;
  firstName: string;
  username: string | null;
  avatarUrl: string | null;
  leaguePoints: number;
  position: number;
  isCurrentUser: boolean;
  lpToday: number;
  positionChange: number;
};

export type LeagueNotificationType =
  | 'season_started'
  | 'safe_zone_reached'
  | 'competition_entered'
  | 'top5_reached'
  | 'overtaken'
  | 'season_ending'
  | 'season_finished'
  | 'promoted'
  | 'demoted'
  | 'maintained';

export type LeagueNotification = {
  id: number;
  type: LeagueNotificationType;
  payload: string | null;
  isRead: boolean;
  createdAt: string;
};

export type LeagueStatusResponse = {
  progress: UserLeagueProgress;
  stats: UserSeasonStats | null;
  position: { position: number; total: number } | null;
  season: LeagueSeason | null;
};

export type LeagueHistoryEntry = {
  seasonId: number;
  weekNumber: number;
  year: number;
  leaguePoints: number;
  tierAtStart: LeagueTier;
  divisionAtStart: number;
  tierAtEnd: LeagueTier | null;
  divisionAtEnd: number | null;
  divisionChange: number | null;
};

// ─── Streak Calendar ─────────────────────────────────────────────────────────

export type StreakActivityDay = {
  date: string; // 'YYYY-MM-DD'
  type: 'play' | 'freeze';
};

export type StreakCalendarResponse = {
  streakDays: number;
  activityDays: StreakActivityDay[];
};

// ─── Friends ──────────────────────────────────────────────────────────────────

export type FriendInfo = {
  id: number;
  firstName: string;
  username: string | null;
  avatarUrl: string | null;
  level: number;
  streakDays: number;
  league: { tier: LeagueTier; division: number } | null;
  friendSince: string | null;
};

export type FriendRequestInfo = {
  id: number;
  fromUser: {
    id: number;
    firstName: string;
    username: string | null;
    avatarUrl: string | null;
    level: number;
  };
  createdAt: string;
};

// ─── Placement Test ─────────────────────────────────────────────────────────

export type PlacementQuestion = {
  meaningId: number;
  word: string;
  originalForm: string | null;
  transcription: string | null;
  correctTranslation: string;
  options: string[];
  direction: string;
};

export type PlacementStartResponse = {
  question: PlacementQuestion;
  questionNumber: number;
  totalQuestions: number;
};

export type PlacementAnswerResponse = {
  isCorrect: boolean;
  questionNumber: number;
  totalQuestions: number;
  nextQuestion: PlacementQuestion | null;
  isFinished: boolean;
};

export type PlacementCompleteResponse = {
  cefr: CefrLevel;
  estimatedVocabulary: number;
  percentile: number;
  subscribedCollections: string[];
};
