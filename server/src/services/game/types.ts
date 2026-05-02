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

// Spelling question (выбор правильного написания)
export type SpellingQuestion = {
  type: 'spelling';
  meaningId: number;
  word: string;              // Показываемое слово (русский перевод)
  options: string[];         // Варианты написания (6 шт)
  correctSpelling: string;   // Правильное написание
  direction: 'ru-en';        // Spelling всегда ru→en
  doubleXpTimeLimitMs?: number;
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
  doubleXpTimeLimitMs?: number;
};

// ─── Word Pool ──────────────────────────────────────────────────────────────

export type PooledMeaning = {
  id: number;
  wordId: number;
  translation: string;
  alternativeTranslations: string[] | null;
  difficulty: 'easy' | 'medium' | 'hard';
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  synonyms?: string[] | null;
  examples?: { text: string; translation: string }[] | null;
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

// ─── Generator Rotation ────────────────────────────────────────────────────

export type GeneratorType = 'en-ru' | 'ru-en' | 'spelling' | 'match-pairs' | 'cloze' | 'listening' | 'dictation' | 'free-recall' | 'encounter';

// Encounter card — пассивный показ слова на первом уровне лестницы.
// Без проверки: пользователь нажимает «Понятно» → recordAnswer({isCorrect: true}) → tier=passive.
export type EncounterCardQuestion = {
  type: 'encounter';
  meaningId: number;
  word: string;                                // англ. слово
  originalForm: string | null;
  translation: string;                          // рус. перевод
  transcription: string | null;
  mnemonic: string | null;                      // AI-mnemonic, если есть
  example: { en: string; ru: string } | null;   // AI-example или Yandex-example
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  direction: 'en-ru';
};

// Match-pairs question (соединение пар)
export type MatchPairsQuestion = {
  type: 'match-pairs';
  pairs: Array<{ meaningId: number; word: string; translation: string }>;
  doubleXpTimeLimitMs?: number;
};

// Cloze question (заполни пропуск в предложении)
export type ClozeQuestion = {
  type: 'cloze';
  meaningId: number;
  sentence: string;        // "I need to _____ a decision"
  sentenceRu: string;      // "Мне нужно принять решение"
  options: string[];        // ["make", "do", "take", "get"]
  correctAnswer: string;    // "make"
  word: string;             // целевое слово (для feedback)
  transcription: string | null;
  doubleXpTimeLimitMs?: number;
};

// Listening question (слушай → выбери перевод)
export type ListeningQuestion = {
  type: 'listening';
  meaningId: number;
  audioWord: string;           // слово для TTS на клиенте
  transcription: string | null;
  options: string[];           // варианты переводов (русские)
  correctAnswer: string;       // правильный перевод
  doubleXpTimeLimitMs?: number;
};

// Dictation question (слушай → напиши)
export type DictationQuestion = {
  type: 'dictation';
  meaningId: number;
  audioWord: string;           // слово для TTS
  hint: string;                // перевод (подсказка)
  correctAnswer: string;       // правильное написание
  acceptableAnswers: string[]; // допустимые варианты
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  doubleXpTimeLimitMs?: number;
};

// Free Recall question (напиши перевод без вариантов)
export type FreeRecallQuestion = {
  type: 'free-recall';
  meaningId: number;
  direction: 'en-ru' | 'ru-en';
  prompt: string;              // слово/перевод для показа
  transcription: string | null; // только для en→ru
  audioWord?: string;          // для TTS (en слово)
  acceptableAnswers: string[]; // все допустимые ответы
  partOfSpeech: 'noun' | 'verb' | 'adj' | 'adv' | 'phrase';
  doubleXpTimeLimitMs?: number;
};

const ROTATION_LOOKBACK = 5;
const MAX_CONSECUTIVE = 3;

/**
 * Выбирает генератор с учётом истории — предотвращает длинные серии одного типа.
 * Вес генератора снижается за каждое появление в последних N вопросах.
 * Жёсткий лимит: MAX_CONSECUTIVE подряд одного типа → исключение.
 */
export function pickGenerator(
  applicable: GeneratorType[],
  recentHistory: GeneratorType[],
): GeneratorType {
  if (applicable.length === 1) return applicable[0]!;

  const recent = recentHistory.slice(-ROTATION_LOOKBACK);

  // Считаем подряд одинаковых с конца
  const lastGen = recent.length > 0 ? recent[recent.length - 1] : undefined;
  let consecutive = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i] === lastGen) consecutive++;
    else break;
  }

  // Исключаем генератор при MAX_CONSECUTIVE подряд
  let candidates = applicable;
  if (consecutive >= MAX_CONSECUTIVE && lastGen) {
    const filtered = applicable.filter(g => g !== lastGen);
    if (filtered.length > 0) candidates = filtered;
  }

  // Веса: базовый 1.0, -0.2 за каждое появление в окне
  const weights = candidates.map(gen => {
    const count = recent.filter(r => r === gen).length;
    return Math.max(0.1, 1.0 - count * 0.2);
  });

  // Взвешенный случайный выбор
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}
