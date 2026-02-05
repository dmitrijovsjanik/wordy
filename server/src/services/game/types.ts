// ─── Question Types ─────────────────────────────────────────────────────────

export type QuestionType = 'multiple-choice' | 'spelling' | 'text-input' | 'match-pairs';

export type QuestionDirection = 'en-ru' | 'ru-en';

// Базовый вопрос
export type BaseQuestion = {
  meaningId: number;
  word: string;
  originalForm: string | null;
  transcription: string | null;
  direction: QuestionDirection;
};

// Multiple choice question
export type MultipleChoiceQuestion = BaseQuestion & {
  type: 'multiple-choice';
  correctTranslation: string;
  options: string[];
};

// Legacy format (для совместимости с текущим API)
export type LegacyQuestion = {
  meaningId: number;
  word: string;
  originalForm: string | null;
  transcription: string | null;
  correctTranslation: string;
  options: string[];
  direction: string;
};

// ─── Word Pool ──────────────────────────────────────────────────────────────

export type PooledMeaning = {
  id: number;
  wordId: number;
  translation: string;
  alternativeTranslations: string[] | null;
  difficulty: 'easy' | 'medium' | 'hard';
  word: {
    id: number;
    text: string;
    transcription: string | null;
    lemma: string | null;
  };
};

export type CustomWordForQuiz = {
  id: number;
  wordText: string;
  translation: string;
};

// ─── Answer Checking ────────────────────────────────────────────────────────

export type AnswerResult = {
  isCorrect: boolean;
  correctTranslation: string;
};

// ─── Language Pairs ─────────────────────────────────────────────────────────

export type LanguagePair = 'en-ru' | 'ru-en';
export const DEFAULT_LANG_PAIR: LanguagePair = 'en-ru';

export function reversePair(pair: LanguagePair): LanguagePair {
  return pair === 'en-ru' ? 'ru-en' : 'en-ru';
}
