// ─── Game Modes ─────────────────────────────────────────────────────────────
// Режим определяет правила игры: лимиты, награды, UI обёртку

export type GameMode = 'infinite' | 'session' | 'duel';

export type GameModeConfig = {
  infinite: {
    mode: 'infinite';
    collectionId?: number;
  };
  session: {
    mode: 'session';
    questionCount: number;
    collectionId?: number;
  };
  duel: {
    mode: 'duel';
    duelId: number;
    opponentId: number;
  };
};

// ─── Question Types ─────────────────────────────────────────────────────────
// Тип вопроса определяет UI и логику взаимодействия

export type QuestionType = 'multiple-choice' | 'spelling' | 'text-input' | 'match-pairs';

// ─── Question Data ──────────────────────────────────────────────────────────
// Данные вопроса, специфичные для каждого типа

// Базовые поля, общие для всех типов вопросов
type BaseQuestion = {
  meaningId: number;
  word: string;
  originalForm: string | null;
  transcription: string | null;
  direction: 'en-ru' | 'ru-en';
};

// Выбор из 4 вариантов
export type MultipleChoiceQuestion = BaseQuestion & {
  type: 'multiple-choice';
  options: string[];
  correctAnswer: string;
};

// Выбор правильного написания (team/tim/teem/tiam)
export type SpellingQuestion = BaseQuestion & {
  type: 'spelling';
  options: string[];
  correctSpelling: string;
};

// Ввод слова вручную
export type TextInputQuestion = BaseQuestion & {
  type: 'text-input';
  correctAnswer: string;
  acceptableAnswers: string[]; // альтернативные правильные варианты
};

// Соединение пар
export type MatchPairsQuestion = {
  type: 'match-pairs';
  pairs: Array<{
    meaningId: number;
    word: string;
    translation: string;
  }>;
};

// Union type для всех вопросов
export type Question =
  | MultipleChoiceQuestion
  | SpellingQuestion
  | TextInputQuestion
  | MatchPairsQuestion;

// ─── Answer Feedback ────────────────────────────────────────────────────────

export type AnswerFeedback = {
  isCorrect: boolean;
  correctAnswer: string;
  // Награды (для infinite mode)
  xpEarned?: number;
  xpModifier?: number;
  lpEarned?: number;
  lpModifier?: number;
  totalXp?: number;
  totalLp?: number;
  level?: number;
  levelUp?: number;
};

// ─── Game State ─────────────────────────────────────────────────────────────

export type GameState = {
  // Режим
  mode: GameMode;
  sessionId: number | null;

  // Текущий вопрос
  currentQuestion: Question | null;
  questionIndex: number;

  // Прогресс
  streak: number;
  correctCount: number;
  totalCount: number;

  // UI состояние
  isLoading: boolean;
  error: string | null;
  feedback: AnswerFeedback | null;
  selectedAnswer: string | null;

  // Для infinite mode — исключаем недавние слова
  recentMeaningIds: number[];

  // Для session mode — ограничение
  maxQuestions: number | null;

  // Для collection filter
  collectionId: number | undefined;
};

// ─── Reward Display ─────────────────────────────────────────────────────────

export type RewardDisplay = {
  xp: number;
  xpMultiplier: number;
  lp: number;
  lpMultiplier: number;
  levelUp?: number;
  key: number;
};
