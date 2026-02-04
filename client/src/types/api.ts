export type User = {
  id: number;
  firstName: string;
  username: string | null;
  avatarUrl: string | null;
  xp: number;
  level: number;
  streakDays: number;
  nativeLanguage: string;
  learningLanguage: string;
  repeatMastered: boolean;
  lastActivityAt: string | null;
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

export type QuizQuestion = {
  meaningId: number;
  word: string;
  correctTranslation: string;
  options: string[];
  direction: string;
};

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
  bestStreak: number;
};

export type ApiError = {
  error: string;
  code: string;
};

// ─── Collections ────────────────────────────────────────────────────────────

export type Collection = {
  id: number;
  type: 'system' | 'user' | 'auto';
  title: string;
  description: string | null;
  iconName: string | null;
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
  translation: string;
  alternativeTranslations?: string[];
  partOfSpeech: string;
  contextExample?: string;
  srsStage: number;
};

export type CollectionDetail = {
  collection: Collection & { isInLibrary: boolean; isActive: boolean };
  words: CollectionWord[];
};

export type DifficultWordsResponse = {
  totalWords: number;
  words: {
    meaningId: number;
    correctCount: number;
    incorrectCount: number;
    word: string;
    translation: string;
  }[];
};

export type AllWordsResponse = {
  words: { word: string; translation: string; alternativeTranslations?: string[] }[];
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
  totalXp?: number;
  level?: number;
  levelUp?: number;
};
