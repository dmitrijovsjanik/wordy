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
  transcription: string | null;
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

export type LearningTier = 'pool' | 'passive' | 'active' | 'review' | 'mastered';
export type ReviewGrade = 'again' | 'hard' | 'good' | 'easy';
export type PoolSwipeAction = 'know' | 'learn' | 'snooze';

// Pool card (L0 v2) — карточка для свайпа в основном потоке.
export type PoolCardApiQuestion = {
  type: 'pool-card';
  wordId: number;
  meaningId: number;
  word: string;
  transcription: string | null;
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  meanings: WordMeaningInfo[];
  forms?: WordFormsInfo | null;
  example: { en: string; ru: string } | null;
};

export type QuizQuestion =
  | PoolCardApiQuestion
  | PassiveRecallApiQuestion  // L1
  | FreeRecallApiQuestion;    // L2 + L3

export type SessionCompleteReason =
  | 'all_in_cooldown'
  | 'collection_exhausted'
  | 'no_words'
  | 'daily_limit_done'
  | 'all_recent';

export type DailyPromotionsInfo = {
  /** Сколько слов уже перешло active → review за текущий учебный день (после 02:00 MSK). */
  count: number;
  /** Максимум, после которого batches не стартуют. */
  limit: number;
};

export type LearningNextResponse =
  | {
      mode?: undefined;
      question: QuizQuestion;
      tier: LearningTier;
      wordId: number;
      dailyPromotions: DailyPromotionsInfo;
      /** true → на этом pickNext maybePromoteBatch стартовал батч. UI показывает
       *  экран «Ты отобрал N слов» перед первым passive-вопросом. */
      batchStarted: boolean;
      /** Размер батча. Релевантно только когда batchStarted=true. */
      batchSize: number;
    }
  | {
      mode: 'session_complete';
      reason: SessionCompleteReason;
      /** Время ближайшего due (для UI «возвращайтесь к …»). null = нет due. */
      nextDueAt: string | null;
      counts: {
        pool: number;
        passive: number;
        active: number;
        review: number;
        mastered: number;
      };
      dailyPromotions: DailyPromotionsInfo;
    };

export type LearningAnswerRequest = {
  wordId: number;
  /** Для L1/L2 — bool. Для L3 — игнорируется (используется grade). */
  isCorrect?: boolean;
  /** Для L3 — обязательно. Для L1/L2 — undefined. */
  grade?: ReviewGrade;
  questionType?: string;
  answerTimeMs?: number;
  streak?: number;
  /** true → пропуск без штрафа (пользователь нажал «не помню/пропустить»). */
  skip?: boolean;
  /** Свободный ввод: сервер ре-валидирует через нормализатор. */
  userAnswer?: string;
  acceptableAnswers?: string[];
  partOfSpeech?: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
};

export type LearningAnswerResponse = {
  isCorrect: boolean;
  /** 'exact' | 'typo' | 'none'. lemma → exact во v2. */
  normalizedVia: 'exact' | 'typo' | 'none' | null;
  /** Правильный текст для UI «вот правильное написание» (при typo / wrong). */
  correctedTo?: string;
  tierBefore: LearningTier;
  tierAfter: LearningTier;
  wasAdvanced: boolean;
  wasReset: boolean;
  becameMastered: boolean;
  nextReviewAt: string | Date;
  // Награды/жизни — те же поля что в v1
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

export type LearningSwipeRequest = {
  wordId: number;
  action: PoolSwipeAction;
  snoozeDays?: number;
  /** Опционально: коллекция, в которой произведён swipe. Нужно maybePromoteBatch
   *  для корректной фильтрации pool по коллекции при триггере батча после swipe. */
  collectionId?: number;
};

// Обзор (этап 3): один режим — карточка = слово + все его eligible meanings.
// Решение (свайп) применяется к слову целиком.
export type ReviewFeedMeaning = {
  meaningId: number;
  translation: string;
  /** Заполнено только у первого meaning по popularity_rank ASC.
   *  UI показывает один пример на карточку, под списком переводов. */
  exampleEn?: string;
  exampleRu?: string;
};

export type ReviewFeedWord = {
  wordId: number;
  text: string;
  transcription: string | null;
  /** POS первого meaning по popularity_rank ASC (одно слово в одной POS-роли). */
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  meanings: ReviewFeedMeaning[];
};

export type ReviewFeedResponse = {
  words: ReviewFeedWord[];
};

export type LearningSwipeResponse = {
  ok: boolean;
  /** true → этот свайп стартовал батч (pool достиг minBatchSize и daily<limit).
   *  UI показывает экран «Ты отобрал N слов» перед первым passive-вопросом. */
  batchStarted: boolean;
  /** Размер стартовавшего батча. Релевантно только когда batchStarted=true. */
  batchSize: number;
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
