export type RuleCategory =
  | 'first_mention'
  | 'unique'
  | 'zero_article'
  | 'a_vs_an'
  | 'fixed_expressions'
  | 'general_plural'
  | 'uncountable'
  | 'superlative'
  | 'ordinal';

export type ArticleAnswer = 'a' | 'an' | 'the' | '—';

export type ArticleBlank = {
  position: number;
  correctAnswer: ArticleAnswer;
  explanation: string;
};

export type ArticleExercise = {
  sentence: string;
  blanks: ArticleBlank[];
  difficulty: 1 | 2 | 3;
  rule: string;
  ruleCategory: RuleCategory;
};

export type ArticleNextResponse = {
  exercise: ArticleExercise;
  exerciseIndex: number;
};

export type ArticleAnswerRequest = {
  exerciseIndex: number;
  blankIndex: number;
  answer: string;
};

export type ArticleAnswerResponse = {
  isCorrect: boolean;
  explanation: string;
  correctAnswer: string;
};

// ─── Tense Quiz Types ──────────────────────────────────────────────────────

export type TenseExercise = {
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

export type TenseNextResponse = {
  exercise: TenseExercise;
  exerciseIndex: number;
};

export type TenseAnswerRequest = {
  exerciseIndex: number;
  answer: string;
};

export type TenseAnswerResponse = {
  isCorrect: boolean;
  explanation: string;
  correctAnswer: string;
  tense: string;
  signalWords: string[];
};

// ─── Collocation Quiz Types ─────────────────────────────────────────────────

export type CollocationType = 'verb_noun' | 'adj_noun' | 'adv_adj';

export type CollocationData = {
  blank: string;
  correctAnswer: string;
  options: string[];
  type: CollocationType;
  translation: string;
  difficulty: 1 | 2 | 3;
};

export type CollocationNextResponse = {
  collocation: CollocationData;
  collocationIndex: number;
};

export type CollocationAnswerRequest = {
  collocationIndex: number;
  answer: string;
};

export type CollocationAnswerResponse = {
  isCorrect: boolean;
  correctAnswer: string;
  translation: string;
};

// ─── False Friends ─────────────────────────────────────────────────────────

export type FalseFriendQuestion = {
  word: string;
  options: string[];
  correctAnswer: string;
  wrongFriend: string;
  example: string;
  exampleRu: string;
  questionIndex: number;
};

export type FalseFriendAnswerResult = {
  isCorrect: boolean;
  correctAnswer: string;
  wrongFriend: string;
  explanation: string;
};
