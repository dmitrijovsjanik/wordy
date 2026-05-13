// Tense match-pairs: сопоставить время с формулой
// Используется как грамматический вопрос в основном квизе

export type TenseFormData = {
  id: string;
  name: string;
  group: 'present' | 'past' | 'future';
  affirmative: string;
  negative: string;
  question: string;
};

const TENSES: TenseFormData[] = [
  {
    id: 'present_simple',
    name: 'Present Simple',
    group: 'present',
    affirmative: 'S + V(-s/-es)',
    negative: 'S + do/does + not + V',
    question: 'Do/Does + S + V?',
  },
  {
    id: 'present_continuous',
    name: 'Present Continuous',
    group: 'present',
    affirmative: 'S + am/is/are + V-ing',
    negative: 'S + am/is/are + not + V-ing',
    question: 'Am/Is/Are + S + V-ing?',
  },
  {
    id: 'present_perfect',
    name: 'Present Perfect',
    group: 'present',
    affirmative: 'S + have/has + V3',
    negative: 'S + have/has + not + V3',
    question: 'Have/Has + S + V3?',
  },
  {
    id: 'present_perfect_continuous',
    name: 'Present Perfect Continuous',
    group: 'present',
    affirmative: 'S + have/has + been + V-ing',
    negative: 'S + have/has + not + been + V-ing',
    question: 'Have/Has + S + been + V-ing?',
  },
  {
    id: 'past_simple',
    name: 'Past Simple',
    group: 'past',
    affirmative: 'S + V2/V-ed',
    negative: 'S + did + not + V',
    question: 'Did + S + V?',
  },
  {
    id: 'past_continuous',
    name: 'Past Continuous',
    group: 'past',
    affirmative: 'S + was/were + V-ing',
    negative: 'S + was/were + not + V-ing',
    question: 'Was/Were + S + V-ing?',
  },
  {
    id: 'past_perfect',
    name: 'Past Perfect',
    group: 'past',
    affirmative: 'S + had + V3',
    negative: 'S + had + not + V3',
    question: 'Had + S + V3?',
  },
  {
    id: 'past_perfect_continuous',
    name: 'Past Perfect Continuous',
    group: 'past',
    affirmative: 'S + had + been + V-ing',
    negative: 'S + had + not + been + V-ing',
    question: 'Had + S + been + V-ing?',
  },
  {
    id: 'future_simple',
    name: 'Future Simple',
    group: 'future',
    affirmative: 'S + will + V',
    negative: 'S + will + not + V',
    question: 'Will + S + V?',
  },
  {
    id: 'future_continuous',
    name: 'Future Continuous',
    group: 'future',
    affirmative: 'S + will + be + V-ing',
    negative: 'S + will + not + be + V-ing',
    question: 'Will + S + be + V-ing?',
  },
  {
    id: 'future_perfect',
    name: 'Future Perfect',
    group: 'future',
    affirmative: 'S + will + have + V3',
    negative: 'S + will + not + have + V3',
    question: 'Will + S + have + V3?',
  },
];

type FormType = 'affirmative' | 'negative' | 'question';

const FORMS: FormType[] = ['affirmative', 'negative', 'question'];

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export type TenseMatchPairsQuestion = {
  type: 'grammar-tense-match';
  pairs: Array<{
    meaningId: number; // synthetic id for MatchPairs component
    word: string;      // tense name
    translation: string; // formula
  }>;
};

/**
 * Генерирует вопрос match-pairs для времён.
 *
 * difficulty 1: одна форма (утверждение), одна группа времён
 * difficulty 2: одна форма, смешанные группы
 * difficulty 3: смешанные формы
 */
export function generateTenseMatchPairs(difficulty: 1 | 2 | 3 = 2): TenseMatchPairsQuestion {
  const pairCount = 4;

  // Выбираем форму
  let form: FormType;
  if (difficulty <= 2) {
    form = FORMS[Math.floor(Math.random() * FORMS.length)]!;
  } else {
    form = 'affirmative'; // placeholder, each pair gets its own
  }

  // Выбираем пул времён
  let pool: TenseFormData[];
  if (difficulty === 1) {
    // Одна группа
    const groups: Array<'present' | 'past' | 'future'> = ['present', 'past', 'future'];
    const group = groups[Math.floor(Math.random() * groups.length)]!;
    pool = TENSES.filter(t => t.group === group);
  } else {
    pool = TENSES;
  }

  // Выбираем 4 случайных
  const selected = shuffle(pool).slice(0, pairCount);

  const pairs = selected.map((tense, idx) => {
    const actualForm = difficulty === 3
      ? FORMS[Math.floor(Math.random() * FORMS.length)]!
      : form;

    return {
      meaningId: -(idx + 1), // synthetic negative IDs
      word: tense.name,
      translation: tense[actualForm],
    };
  });

  return {
    type: 'grammar-tense-match',
    pairs,
  };
}
