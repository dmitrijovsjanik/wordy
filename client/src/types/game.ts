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

export type QuestionType = 'multiple-choice' | 'spelling' | 'text-input' | 'match-pairs' | 'cloze' | 'listening' | 'dictation' | 'free-recall';

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

// Cloze question (заполни пропуск в предложении)
export type ClozeQuestion = {
  type: 'cloze';
  meaningId: number;
  sentence: string;
  sentenceRu: string;
  options: string[];
  correctAnswer: string;
  word: string;
  transcription: string | null;
};

// Listening question (слушай → выбери перевод)
export type ListeningQuestion = {
  type: 'listening';
  meaningId: number;
  audioWord: string;
  transcription: string | null;
  options: string[];
  correctAnswer: string;
};

// Dictation question (слушай → напиши)
export type DictationQuestion = {
  type: 'dictation';
  meaningId: number;
  audioWord: string;
  hint: string;
  correctAnswer: string;
  acceptableAnswers: string[];
};

// Free Recall question (напиши перевод без вариантов)
export type FreeRecallQuestion = {
  type: 'free-recall';
  meaningId: number;
  direction: 'en-ru' | 'ru-en';
  prompt: string;
  transcription: string | null;
  audioWord?: string;
  acceptableAnswers: string[];
};

// Union type для всех вопросов
export type Question =
  | MultipleChoiceQuestion
  | SpellingQuestion
  | TextInputQuestion
  | MatchPairsQuestion
  | ClozeQuestion
  | ListeningQuestion
  | DictationQuestion
  | FreeRecallQuestion;

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
  // Примеры предложений (для глубокой обработки)
  examples?: { en: string; ru: string }[];
  // Milestones
  milestones?: { id: string; type: string; threshold: number; title: string; description: string; gemsReward: number; icon: string }[];
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

// ─── Answer History ─────────────────────────────────────────────────────────

export type AnswerHistoryEntry = {
  question: string;        // Что спрашивали (слово, предложение, prompt)
  userAnswer: string;      // Что ответил пользователь
  correctAnswer: string;   // Правильный ответ
  isCorrect: boolean;
  type: string;            // Тип вопроса (multiple-choice, spelling, cloze и т.д.)
  timestamp: number;       // Date.now()
};

// ─── Reward Display ─────────────────────────────────────────────────────────

export type RewardDisplay = {
  xp: number;
  xpMultiplier: number;
  lp: number;
  lpMultiplier: number;
  levelUp?: number;
  doubleXp?: boolean;
  key: number;
};
