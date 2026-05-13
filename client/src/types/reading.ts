// ─── Reading Module Types ──────────────────────────────────────────────────

export type ReadingLevel = 'A1' | 'A2' | 'B1';

export type ReadingQuestion = {
  question: string;
  questionRu: string;
  options: string[];
};

export type ReadingPassage = {
  id: string;
  level: ReadingLevel;
  title: string;
  titleRu: string;
  topic: string;
  text: string;
  textRu: string;
  targetWords: string[];
  questions: ReadingQuestion[];
};

export type ReadingNextResponse = {
  passage: ReadingPassage;
  passageIndex: number;
};

export type ReadingAnswerRequest = {
  passageIndex: number;
  questionIndex: number;
  answerIndex: number;
  level?: string;
};

export type ReadingAnswerResponse = {
  isCorrect: boolean;
  correctIndex: number;
};
