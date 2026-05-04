export type User = {
  id: number;
  telegramId: string | null;
  vkId: string | null;
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
  ttsVoice: string;
  premiumUntil: string | null;
  premiumPlan: string | null;
  autoRenew: boolean;
  lastActivityAt: string | null;
  createdAt: string;
  estimatedCefr: CefrLevel | null;
  lives: number;
  livesRestoredAt: string | null;
  xpBoostUntil: string | null;
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
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  doubleXpTimeLimitMs?: number;
};

// Информация об одном значении слова — для L1-3 word-level карточек,
// которые показывают все значения слова списком (encounter, passive-recall,
// active free-recall).
export type WordMeaningInfo = {
  meaningId: number;
  translation: string;
  example: { en: string; ru: string } | null;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
};

// Грамматическая форма слова и её роль (для подсказок и подсветки в примерах).
// Сервер: server/src/services/word-forms-service.ts.
export type WordFormInfo = {
  text: string;
  label: string;
};

export type WordFormsInfo = {
  base: string;
  partOfSpeech: 'verb' | 'noun' | 'adjective' | 'modal' | 'pronoun' | 'other';
  forms: WordFormInfo[];
};

// Free Recall question (напиши перевод без вариантов)
export type FreeRecallApiQuestion = {
  type: 'free-recall';
  meaningId: number;
  /** Word-level ID — присутствует когда вопрос на L3 active recall (word-level).
   *  null/undefined для meaning-level (rollback после ошибки на L4). */
  wordId?: number | null;
  direction: 'en-ru' | 'ru-en';
  prompt: string;
  transcription: string | null;
  audioWord?: string;
  acceptableAnswers: string[];
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  /** Все значения слова (топ-3 по popularity_rank). Заполняется только для
   *  word-level вопросов; для meaning-level rollback'а пуст или содержит одно. */
  meanings?: WordMeaningInfo[];
  /** Грамматические формы слова (L3 word-level). */
  forms?: WordFormsInfo | null;
  doubleXpTimeLimitMs?: number;
};

// ─── Grammar Questions (встроенные в основной квиз) ─────────────────────────

export type GrammarArticleApiQuestion = {
  type: 'grammar-article';
  exercise: {
    sentence: string;
    blanks: Array<{ position: number; correctAnswer: string; explanation: string }>;
    difficulty: 1 | 2 | 3;
    rule: string;
    ruleCategory: string;
  };
  exerciseIndex: number;
};

export type GrammarTenseApiQuestion = {
  type: 'grammar-tense';
  exercise: {
    sentence: string;
    sentenceRu: string;
    subject: string;
    options: string[];
    correctAnswer: string;
    tense: string;
    signalWords: string[];
    explanation: string;
    difficulty: 1 | 2 | 3;
  };
  exerciseIndex: number;
};

export type GrammarCollocationApiQuestion = {
  type: 'grammar-collocation';
  collocation: {
    blank: string;
    correctAnswer: string;
    options: string[];
    type: string;
    translation: string;
    difficulty: 1 | 2 | 3;
  };
  collocationIndex: number;
};

export type GrammarFalseFriendApiQuestion = {
  type: 'grammar-false-friend';
  word: string;
  options: string[];
  correctAnswer: string;
  wrongFriend: string;
  example: string;
  exampleRu: string;
  questionIndex: number;
};

export type GrammarTenseMatchApiQuestion = {
  type: 'grammar-tense-match';
  pairs: Array<{
    meaningId: number;
    word: string;
    translation: string;
  }>;
};

export type GrammarApiQuestion =
  | GrammarArticleApiQuestion
  | GrammarTenseApiQuestion
  | GrammarCollocationApiQuestion
  | GrammarFalseFriendApiQuestion
  | GrammarTenseMatchApiQuestion;

// Encounter card — пассивный показ слова на первом уровне лестницы.
// Без проверки. Клиент рендерит карточку и одну кнопку «Понятно»,
// которая → answer({isCorrect: true}).
//
// Word-level: показывает топ-N значений слова списком. translation/example
// в корне — backward-compat (representative meaning, первое из meanings).
export type EncounterCardApiQuestion = {
  type: 'encounter';
  /** Representative meaning ID — для legacy code и meaning-level events. */
  meaningId: number;
  /** Word-level ID. Присутствует на новых ответах сервера. null если
   *  сервер не вернул (старая версия) — клиент работает в backward-compat режиме. */
  wordId?: number | null;
  word: string;
  originalForm: string | null;
  /** Translation representative meaning'а. Используется как fallback для
   *  компонентов, которые ещё не умеют рендерить meanings list. */
  translation: string;
  transcription: string | null;
  mnemonic: string | null;
  /** Пример representative meaning'а (для backward-compat). */
  example: { en: string; ru: string } | null;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  direction: 'en-ru';
  meaningIndex: number;
  totalMeanings: number;
  /** Все значения слова (топ-3 по popularity_rank). Заполняется на word-level
   *  encounter'е. Если undefined — значит ответ от старого сервера, рендерим
   *  только translation/example как раньше. */
  meanings?: WordMeaningInfo[];
  /** Грамматические формы слова (L1 word-level). */
  forms?: WordFormsInfo | null;
  doubleXpTimeLimitMs?: number;
};

// Cloze-input — production-tier: предложение с пропуском без вариантов.
// Пользователь печатает пропущенное слово.
export type ClozeInputApiQuestion = {
  type: 'cloze-input';
  meaningId: number;
  sentence: string;       // "I need to _____ a decision"
  sentenceRu: string;     // "Мне нужно принять решение"
  correctAnswer: string;
  acceptableAnswers: string[];
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  word: string;
  doubleXpTimeLimitMs?: number;
};

// Passive recall card — флешкарта с флипом и самооценкой через свайп.
// Word-level: показывает все значения слова на обратной стороне.
// Свайп вправо = isCorrect=true, влево = false.
export type PassiveRecallApiQuestion = {
  type: 'passive-recall';
  /** Representative meaning ID. */
  meaningId: number;
  /** Word-level ID (новый сервер). null/undefined — старый сервер, fallback на one-meaning UI. */
  wordId?: number | null;
  word: string;
  /** Translation representative meaning'а (fallback). */
  translation: string;
  /** Пример representative meaning'а (fallback). */
  example: { en: string; ru: string } | null;
  mnemonic: string | null;
  meaningIndex: number;
  totalMeanings: number;
  /** Все значения слова (топ-3 по popularity_rank). На word-level — обязательно. */
  meanings?: WordMeaningInfo[];
  /** Грамматические формы слова (L2 word-level). */
  forms?: WordFormsInfo | null;
  doubleXpTimeLimitMs?: number;
};

export type LearningTier = 'encounter' | 'passive' | 'active' | 'production' | 'review';

// Карточка из режима обзора (фаза 4).
export type ReviewFeedCard = {
  meaningId: number;
  word: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  cefr: string | null;
  example: { en: string; ru: string } | null;
  mnemonic: string | null;
};

export type ReviewFeedResponse = {
  cards: ReviewFeedCard[];
};

// Режим A: слова со всеми значениями.
export type ReviewFeedMeaning = {
  meaningId: number;
  translation: string;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  cefr: string | null;
  example: { en: string; ru: string } | null;
  mnemonic: string | null;
};

export type ReviewFeedWord = {
  wordId: number;
  word: string;
  transcription: string | null;
  meanings: ReviewFeedMeaning[];
};

export type ReviewFeedWordsResponse = {
  words: ReviewFeedWord[];
};

export type LearningNextResponse =
  | {
      mode?: undefined;
      question: QuizQuestion | null;
      tier: LearningTier | null;
      /** Word-level ID для L1-3 + word-review. null для L4 production / rollback
       *  / старого сервера (backward compat). Клиент использует это поле для
       *  маршрутизации /api/learning/answer на word-level vs meaning-level. */
      wordId?: number | null;
    }
  | {
      /** Активная колода пуста и pending_pool < poolMinForResume —
       *  переключиться на встроенный обзор для пополнения пула. */
      mode: 'embedded_review';
      poolSize: number;
      poolMinForResume: number;
    }
  | {
      /** Активная колода пуста, пул пуст, и в общей базе нет доступных
       *  слов для обзора (исчерпан CEFR-диапазон). Стена. */
      mode: 'embedded_review_empty';
    };

export type LearningSwipeResponse = {
  ok: boolean;
  /** Размер pending_pool после применения батча. Клиент сравнивает с
   *  poolMinForResume чтобы выйти из встроенного обзора. */
  poolSize: number;
  /** Размер активной колоды (state='learning' AND tier IN encounter/passive/active). */
  activeDeckSize: number;
};

export type LearningAnswerResponse = {
  isCorrect: boolean;
  normalizedVia: 'exact' | 'lemma' | 'typo' | 'none' | null;
  tierBefore: LearningTier;
  tierAfter: LearningTier;
  becameLearned: boolean;
  wasReset: boolean;
  nextReviewAt: string | Date;
  xpEarned: number;
  xpModifier?: number;
  totalXp?: number;
  level?: number;
  levelUp?: number;
  lpEarned: number;
  lpModifier?: number;
  totalLp?: number;
  gemsEarned: number;
  lives: number;
  livesRestoredAt: string | null;
  livesExhausted: boolean;
};

// QuizQuestion — типы вопросов, которые могут прийти на главную и в дуэли.
// Cloze (только production-tier, off) и Grammar (отдельная страница /grammar
// со своими endpoint'ами) сюда не входят. ClozeApiQuestion/GrammarApiQuestion
// сохраняются в файле для совместимости со старым quiz-service на сервере.
export type QuizQuestion =
  | QuizQuestionBase
  | MatchPairsApiQuestion
  | ListeningApiQuestion
  | DictationApiQuestion
  | FreeRecallApiQuestion
  | EncounterCardApiQuestion
  | PassiveRecallApiQuestion
  | ClozeInputApiQuestion;

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
  mnemonic?: string; // мнемоника для запоминания слова
  milestones?: MilestoneData[]; // достигнутые milestones
  lives?: number;
  livesRestoredAt?: string | null;
  livesExhausted?: boolean;
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

export type GrammarAnswerResponse = {
  isCorrect: boolean;
  correctAnswer: string;
  explanation?: string;
  xpEarned: number;
  xpModifier?: number;
  totalXp?: number;
  level?: number;
  levelUp?: number;
  lpEarned: number;
  lpModifier?: number;
  totalLp?: number;
  gemsEarned?: number;
  dailyCorrectCount?: number;
  lives?: number;
  livesRestoredAt?: string | null;
  livesExhausted?: boolean;
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
  lives?: number;
  livesRestoredAt?: string | null;
  livesExhausted?: boolean;
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
  isPremium?: boolean;
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
