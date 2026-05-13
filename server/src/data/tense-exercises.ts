// ─── Types ────────────────────────────────────────────────────────────────────

export const TENSE_IDS = [
  'present_simple', 'present_continuous', 'present_perfect', 'present_perfect_continuous',
  'past_simple', 'past_continuous', 'past_perfect', 'past_perfect_continuous',
  'future_simple', 'future_going_to', 'future_continuous', 'future_perfect',
] as const;

export type TenseId = (typeof TENSE_IDS)[number];

type SentenceForm = 'affirmative' | 'negative' | 'question';
type Difficulty = 1 | 2 | 3;

type CompactExercise = {
  sentence: string;
  ru: string;
  answer: string;
  options: string[];
  signalWords?: string[];
  explanation: string;
  difficulty?: Difficulty;
  subject?: string;
};

type FormGroup = {
  form: SentenceForm;
  exercises: CompactExercise[];
};

type TenseBlock = {
  tense: TenseId;
  defaultDifficulty: Difficulty;
  forms: FormGroup[];
};

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

// ─── Subject extraction ───────────────────────────────────────────────────────

const NON_SUBJECT_WORDS = new Set([
  'usually', 'always', 'never', 'often', 'sometimes', 'rarely', 'seldom',
  'probably', 'already', 'just', 'ever', 'still', 'also',
  'after', 'before', 'when', 'while', 'if', 'since', 'until', 'because',
]);

function extractSubject(sentence: string): string {
  const blankPositions = [...sentence.matchAll(/___/g)].map(m => m.index);

  // "Wh-word ___ subject ___" questions: Why/What/When/How long ___ you ___
  const whMatch = sentence.match(/^(?:What|Why|When|Where|How long|How)\s+___\s+([\w\s]*?)\s+___/i);
  if (whMatch) {
    const words = whMatch[1].trim().split(/\s+/);
    const filtered = words.filter(w => !NON_SUBJECT_WORDS.has(w.toLowerCase()));
    return filtered.join(' ') || whMatch[1].trim();
  }

  // "___ subject ___" questions (no Wh-word)
  if (blankPositions.length >= 2 && sentence.trimStart().startsWith('___')) {
    const between = sentence.slice(blankPositions[0] + 3, blankPositions[1]).trim();
    const words = between.split(/\s+/);
    const filtered = words.filter(w => !NON_SUBJECT_WORDS.has(w.toLowerCase()));
    return filtered.join(' ') || between;
  }

  // Sentences with introductory clauses before comma
  const commaIdx = sentence.lastIndexOf(',');
  const blankIdx = sentence.indexOf('___');
  let segment = sentence;
  if (commaIdx !== -1 && blankIdx > commaIdx) {
    segment = sentence.slice(commaIdx + 1);
  }

  const beforeBlank = segment.split('___')[0].trim();

  let cleaned = beforeBlank
    .replace(/^(?:Look(?:\s+at\s+those\s+clouds)?[!.]?\s*)/i, '')
    .replace(/^(?:Listen[!.]?\s*)/i, '')
    .replace(/^(?:Be careful[!.]?\s*)/i, '')
    .replace(/^(?:Don't\s+\w+[^,]*[.,]\s*)/i, '')
    .replace(/^(?:I think\s+)/i, '')
    .replace(/^(?:I promise\s+)/i, '')
    .replace(/^(?:I realized\s+)/i, '')
    .replace(/^(?:It's cold\.\s*)/i, '')
    .replace(/^(?:The ground was wet\.\s*)/i, '')
    .replace(/^(?:Her eyes were red\.\s*)/i, '')
    .replace(/^(?:He was tired because\s+)/i, '')
    .trim();

  cleaned = cleaned.replace(/[.,!?]+$/, '').trim();

  const words = cleaned.split(/\s+/);
  while (words.length > 1 && NON_SUBJECT_WORDS.has(words[0].toLowerCase())) {
    words.shift();
  }
  while (words.length > 1 && NON_SUBJECT_WORDS.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }

  return words.join(' ');
}

// ─── Build function ───────────────────────────────────────────────────────────

function buildExercises(data: TenseBlock[]): TenseExercise[] {
  const result: TenseExercise[] = [];
  for (const block of data) {
    for (const formGroup of block.forms) {
      for (const ex of formGroup.exercises) {
        result.push({
          sentence: ex.sentence,
          sentenceRu: ex.ru,
          subject: ex.subject ?? extractSubject(ex.sentence),
          options: ex.options,
          correctAnswer: ex.answer,
          tense: block.tense,
          signalWords: ex.signalWords ?? [],
          explanation: ex.explanation,
          difficulty: ex.difficulty ?? block.defaultDifficulty,
        });
      }
    }
  }
  return result;
}

// ─── Exercise data ────────────────────────────────────────────────────────────

const TENSE_DATA: TenseBlock[] = [
  // ─── Present Simple ──────────────────────────────────────────
  {
    tense: 'present_simple',
    defaultDifficulty: 1,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'She ___ to school every day.',
            ru: 'Она ходит в школу каждый день.',
            answer: 'goes',
            options: ['goes', 'went', 'is going', 'has gone'],
            signalWords: ['every day'],
            explanation: 'Present Simple для регулярных действий. Сигнал: every day.',
          },
          {
            sentence: 'Water ___ at 100 degrees Celsius.',
            ru: 'Вода кипит при 100 градусах Цельсия.',
            answer: 'boils',
            options: ['boils', 'is boiling', 'boiled', 'has boiled'],
            explanation: 'Present Simple для общеизвестных фактов и законов природы.',
          },
          {
            sentence: 'He usually ___ at 7 a.m.',
            ru: 'Он обычно просыпается в 7 утра.',
            answer: 'wakes up',
            options: ['wakes up', 'woke up', 'is waking up', 'has woken up'],
            signalWords: ['usually'],
            explanation: 'Present Simple для привычек. Сигнал: usually.',
          },
          {
            sentence: 'The train ___ at 9:15 every morning.',
            ru: 'Поезд отправляется в 9:15 каждое утро.',
            answer: 'leaves',
            options: ['leaves', 'is leaving', 'left', 'will leave'],
            signalWords: ['every morning'],
            explanation: 'Present Simple для расписаний. Сигнал: every morning.',
          },
          {
            sentence: 'My mother never ___ coffee.',
            ru: 'Моя мама никогда не пьёт кофе.',
            answer: 'drinks',
            options: ['drinks', 'is drinking', 'drank', 'has drunk'],
            signalWords: ['never'],
            explanation: 'Present Simple с наречием частоты never.',
          },
          {
            sentence: 'The shop ___ at 9 and ___ at 6.',
            ru: 'Магазин открывается в 9 и закрывается в 6.',
            answer: 'opens ... closes',
            options: ['opens ... closes', 'is opening ... closing', 'opened ... closed', 'will open ... close'],
            explanation: 'Present Simple для расписаний и графиков работы.',
          },
          {
            sentence: 'If it ___ tomorrow, we will stay at home.',
            ru: 'Если завтра будет дождь, мы останемся дома.',
            answer: 'rains',
            options: ['rains', 'will rain', 'is raining', 'is going to rain'],
            signalWords: ['If', 'tomorrow'],
            explanation: 'Present Simple в условных предложениях первого типа (after if, when, as soon as).',
            difficulty: 3,
          },
        ],
      },
      {
        form: 'negative',
        exercises: [
          {
            sentence: 'They ___ spicy food.',
            ru: 'Они не любят острую еду.',
            answer: 'don\'t like',
            options: ['don\'t like', 'didn\'t like', 'aren\'t liking', 'haven\'t liked'],
            explanation: 'Present Simple для постоянных предпочтений и состояний.',
          },
        ],
      },
      {
        form: 'question',
        exercises: [
          {
            sentence: '___ you ___ French?',
            ru: 'Ты говоришь по-французски?',
            answer: 'Do ... speak',
            options: ['Do ... speak', 'Are ... speaking', 'Did ... speak', 'Have ... spoken'],
            explanation: 'Present Simple для общих умений и способностей.',
          },
        ],
      },
    ],
  },

  // ─── Present Continuous ──────────────────────────────────────────
  {
    tense: 'present_continuous',
    defaultDifficulty: 1,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'Look! The children ___ in the park right now.',
            ru: 'Смотри! Дети играют в парке прямо сейчас.',
            answer: 'are playing',
            options: ['are playing', 'play', 'played', 'have played'],
            signalWords: ['right now', 'Look!'],
            explanation: 'Present Continuous для действий, происходящих прямо сейчас. Сигнал: right now, Look!',
          },
          {
            sentence: 'She ___ for her exams at the moment.',
            ru: 'Она готовится к экзаменам в данный момент.',
            answer: 'is studying',
            options: ['is studying', 'studies', 'studied', 'has studied'],
            signalWords: ['at the moment'],
            explanation: 'Present Continuous для текущих действий. Сигнал: at the moment.',
          },
          {
            sentence: 'We ___ to a new apartment next week.',
            ru: 'Мы переезжаем в новую квартиру на следующей неделе.',
            answer: 'are moving',
            options: ['are moving', 'move', 'moved', 'will move'],
            signalWords: ['next week'],
            explanation: 'Present Continuous для запланированных действий в ближайшем будущем.',
            difficulty: 2,
          },
          {
            sentence: 'He ___ about the weather.',
            ru: 'Он вечно жалуется на погоду.',
            answer: 'is always complaining',
            options: ['is always complaining', 'always complains', 'always complained', 'has always complained'],
            signalWords: ['always'],
            explanation: 'Present Continuous с always для выражения раздражения.',
            difficulty: 2,
          },
          {
            sentence: 'I ___ an interesting book these days.',
            ru: 'В эти дни я читаю интересную книгу.',
            answer: 'am reading',
            options: ['am reading', 'read', 'was reading', 'have read'],
            signalWords: ['these days'],
            explanation: 'Present Continuous для временных действий в текущий период. Сигнал: these days.',
          },
          {
            sentence: 'The baby ___. Please be quiet.',
            ru: 'Ребёнок спит. Пожалуйста, тише.',
            answer: 'is sleeping',
            options: ['is sleeping', 'sleeps', 'slept', 'was sleeping'],
            explanation: 'Present Continuous для действия, происходящего в момент речи.',
          },
          {
            sentence: 'Listen! Someone ___ on the door.',
            ru: 'Слушай! Кто-то стучит в дверь.',
            answer: 'is knocking',
            options: ['is knocking', 'knocks', 'knocked', 'has knocked'],
            signalWords: ['Listen!'],
            explanation: 'Present Continuous для действия, происходящего прямо сейчас. Сигнал: Listen!',
          },
        ],
      },
      { form: 'negative', exercises: [] },
      {
        form: 'question',
        exercises: [
          {
            sentence: 'Why ___ you ___ a coat? It\'s hot outside!',
            ru: 'Почему ты в пальто? На улице жарко!',
            answer: 'are ... wearing',
            options: ['are ... wearing', 'do ... wear', 'did ... wear', 'have ... worn'],
            explanation: 'Present Continuous для действия, происходящего в момент речи.',
          },
        ],
      },
    ],
  },

  // ─── Present Perfect ──────────────────────────────────────────
  {
    tense: 'present_perfect',
    defaultDifficulty: 1,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'I ___ Paris three times.',
            ru: 'Я был(а) в Париже три раза.',
            answer: 'have visited',
            options: ['have visited', 'visited', 'am visiting', 'visit'],
            signalWords: ['three times'],
            explanation: 'Present Perfect для опыта (сколько раз). Сигнал: three times.',
          },
          {
            sentence: 'She ___ her homework.',
            ru: 'Она уже закончила домашнюю работу.',
            answer: 'has already finished',
            options: ['has already finished', 'already finished', 'is already finishing', 'already finishes'],
            signalWords: ['already'],
            explanation: 'Present Perfect с already для завершённого действия. Сигнал: already.',
          },
          {
            sentence: 'They ___ in this city for ten years.',
            ru: 'Они живут в этом городе десять лет.',
            answer: 'have lived',
            options: ['have lived', 'lived', 'are living', 'live'],
            signalWords: ['for'],
            explanation: 'Present Perfect с for для длительности до настоящего момента. Сигнал: for ten years.',
          },
          {
            sentence: 'He ___ at the airport.',
            ru: 'Он только что прибыл в аэропорт.',
            answer: 'has just arrived',
            options: ['has just arrived', 'just arrived', 'is just arriving', 'just arrives'],
            signalWords: ['just'],
            explanation: 'Present Perfect с just для только что завершённых действий. Сигнал: just.',
          },
          {
            sentence: 'I ___ Mexican food.',
            ru: 'Я никогда не ел(а) мексиканскую еду.',
            answer: 'have never eaten',
            options: ['have never eaten', 'never ate', 'am never eating', 'never eat'],
            signalWords: ['never'],
            explanation: 'Present Perfect с never для отсутствия опыта. Сигнал: never.',
          },
          {
            sentence: 'I ___ him since childhood.',
            ru: 'Я знаю его с детства.',
            answer: 'have known',
            options: ['have known', 'know', 'am knowing', 'knew'],
            signalWords: ['since'],
            explanation: 'Present Perfect с since для состояния, длящегося до сейчас. Глагол know — stative, не используется в Continuous.',
            difficulty: 2,
          },
        ],
      },
      {
        form: 'negative',
        exercises: [
          {
            sentence: 'We ___ him since Monday.',
            ru: 'Мы не видели его с понедельника.',
            answer: 'haven\'t seen',
            options: ['haven\'t seen', 'didn\'t see', 'aren\'t seeing', 'don\'t see'],
            signalWords: ['since'],
            explanation: 'Present Perfect с since для действия от определённого момента до сейчас. Сигнал: since.',
          },
          {
            sentence: 'She ___ me yet.',
            ru: 'Она ещё мне не позвонила.',
            answer: 'hasn\'t called',
            options: ['hasn\'t called', 'didn\'t call', 'isn\'t calling', 'doesn\'t call'],
            signalWords: ['yet'],
            explanation: 'Present Perfect с yet в отрицаниях (ещё не). Сигнал: yet.',
          },
          {
            sentence: 'He ___ his parents since he moved abroad.',
            ru: 'Он не видел родителей с тех пор, как переехал за границу.',
            answer: 'hasn\'t seen',
            options: ['hasn\'t seen', 'didn\'t see', 'doesn\'t see', 'wasn\'t seeing'],
            signalWords: ['since'],
            explanation: 'Present Perfect с since для действия, длящегося от момента в прошлом до настоящего. Сигнал: since.',
            difficulty: 2,
          },
        ],
      },
      {
        form: 'question',
        exercises: [
          {
            sentence: '___ you ever ___ sushi?',
            ru: 'Ты когда-нибудь пробовал(а) суши?',
            answer: 'Have ... tried',
            options: ['Have ... tried', 'Did ... try', 'Do ... try', 'Are ... trying'],
            signalWords: ['ever'],
            explanation: 'Present Perfect с ever для вопросов о жизненном опыте. Сигнал: ever.',
          },
        ],
      },
    ],
  },

  // ─── Present Perfect Continuous ──────────────────────────────────────────
  {
    tense: 'present_perfect_continuous',
    defaultDifficulty: 2,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'She ___ here since 2019.',
            ru: 'Она работает здесь с 2019 года.',
            answer: 'has been working',
            options: ['has been working', 'works', 'is working', 'worked'],
            signalWords: ['since'],
            explanation: 'Present Perfect Continuous для действия, начавшегося в прошлом и продолжающегося сейчас. Сигнал: since.',
          },
          {
            sentence: 'They ___ tennis for two hours.',
            ru: 'Они играют в теннис уже два часа.',
            answer: 'have been playing',
            options: ['have been playing', 'are playing', 'play', 'played'],
            signalWords: ['for two hours'],
            explanation: 'Present Perfect Continuous для действия, длящегося определённое время до сейчас. Сигнал: for two hours.',
          },
          {
            sentence: 'It ___ all day. The streets are wet.',
            ru: 'Дождь идёт весь день. Улицы мокрые.',
            answer: 'has been raining',
            options: ['has been raining', 'is raining', 'rains', 'rained'],
            signalWords: ['all day'],
            explanation: 'Present Perfect Continuous для действия, длящегося весь день и имеющего видимый результат. Сигнал: all day.',
          },
          {
            sentence: 'I ___ English for five years.',
            ru: 'Я изучаю английский пять лет.',
            answer: 'have been studying',
            options: ['have been studying', 'study', 'am studying', 'studied'],
            signalWords: ['for five years'],
            explanation: 'Present Perfect Continuous для действия, продолжающегося длительное время. Сигнал: for five years.',
          },
          {
            sentence: 'He ___. He is out of breath.',
            ru: 'Он бегал. Он запыхался.',
            answer: 'has been running',
            options: ['has been running', 'is running', 'runs', 'ran'],
            explanation: 'Present Perfect Continuous для недавнего действия с видимым результатом (запыхался).',
          },
          {
            sentence: 'We ___ for six hours. Let\'s stop.',
            ru: 'Мы ехали шесть часов. Давайте остановимся.',
            answer: 'have been driving',
            options: ['have been driving', 'are driving', 'drove', 'drive'],
            signalWords: ['for six hours'],
            explanation: 'Present Perfect Continuous для действия, продолжавшегося до момента речи. Сигнал: for six hours.',
          },
          {
            sentence: 'She ___ since morning. The kitchen smells great.',
            ru: 'Она готовит с утра. В кухне отлично пахнет.',
            answer: 'has been cooking',
            options: ['has been cooking', 'is cooking', 'cooks', 'cooked'],
            signalWords: ['since morning'],
            explanation: 'Present Perfect Continuous для действия, длящегося с определённого момента. Сигнал: since morning.',
          },
          {
            sentence: 'She ___ at this company for 10 years, and she still loves it.',
            ru: 'Она работает в этой компании 10 лет и до сих пор любит свою работу.',
            answer: 'has been working',
            options: ['has been working', 'works', 'is working', 'worked'],
            signalWords: ['for 10 years', 'still'],
            explanation: 'Present Perfect Continuous для действия, продолжающегося до сих пор. Сигнал: for + still.',
            difficulty: 3,
          },
        ],
      },
      { form: 'negative', exercises: [] },
      {
        form: 'question',
        exercises: [
          {
            sentence: 'How long ___ you ___ for the bus?',
            ru: 'Как долго ты ждёшь автобус?',
            answer: 'have ... been waiting',
            options: ['have ... been waiting', 'do ... wait', 'are ... waiting', 'did ... wait'],
            signalWords: ['How long'],
            explanation: 'Present Perfect Continuous с How long для вопроса о длительности. Сигнал: How long.',
          },
        ],
      },
    ],
  },

  // ─── Past Simple ──────────────────────────────────────────
  {
    tense: 'past_simple',
    defaultDifficulty: 1,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'I ___ a new phone yesterday.',
            ru: 'Вчера я купил(а) новый телефон.',
            answer: 'bought',
            options: ['bought', 'have bought', 'was buying', 'buy'],
            signalWords: ['yesterday'],
            explanation: 'Past Simple для завершённого действия в прошлом. Сигнал: yesterday.',
          },
          {
            sentence: 'She ___ her husband in 2010.',
            ru: 'Она познакомилась с мужем в 2010 году.',
            answer: 'met',
            options: ['met', 'has met', 'was meeting', 'meets'],
            signalWords: ['in 2010'],
            explanation: 'Past Simple для конкретного момента в прошлом. Сигнал: in 2010.',
          },
          {
            sentence: 'We ___ our vacation in Italy two years ago.',
            ru: 'Мы провели отпуск в Италии два года назад.',
            answer: 'spent',
            options: ['spent', 'have spent', 'were spending', 'spend'],
            signalWords: ['two years ago'],
            explanation: 'Past Simple для завершённого действия. Сигнал: two years ago.',
          },
          {
            sentence: 'The movie ___ at 8 and ___ at 10.',
            ru: 'Фильм начался в 8 и закончился в 10.',
            answer: 'started ... ended',
            options: ['started ... ended', 'has started ... ended', 'was starting ... ending', 'starts ... ends'],
            explanation: 'Past Simple для последовательных завершённых действий в прошлом.',
          },
          {
            sentence: 'He ___ his leg last winter.',
            ru: 'Он сломал ногу прошлой зимой.',
            answer: 'broke',
            options: ['broke', 'has broken', 'was breaking', 'breaks'],
            signalWords: ['last winter'],
            explanation: 'Past Simple для события в прошлом. Сигнал: last winter.',
          },
          {
            sentence: 'When I was a child, I ___ to be an astronaut.',
            ru: 'Когда я был(а) ребёнком, я хотел(а) стать космонавтом.',
            answer: 'wanted',
            options: ['wanted', 'was wanting', 'have wanted', 'had wanted'],
            signalWords: ['When I was a child'],
            explanation: 'Past Simple для состояния в прошлом. Want — stative verb, не используется в Continuous.',
            difficulty: 2,
          },
        ],
      },
      {
        form: 'negative',
        exercises: [
          {
            sentence: 'They ___ to the party last night.',
            ru: 'Они не ходили на вечеринку вчера вечером.',
            answer: 'didn\'t go',
            options: ['didn\'t go', 'haven\'t gone', 'weren\'t going', 'don\'t go'],
            signalWords: ['last night'],
            explanation: 'Past Simple для отрицания в прошлом. Сигнал: last night.',
          },
        ],
      },
      {
        form: 'question',
        exercises: [
          {
            sentence: '___ he ___ you this morning?',
            ru: 'Он звонил тебе сегодня утром?',
            answer: 'Did ... call',
            options: ['Did ... call', 'Has ... called', 'Was ... calling', 'Does ... call'],
            signalWords: ['this morning'],
            explanation: 'Past Simple для действия в конкретный момент, если утро уже прошло.',
            difficulty: 2,
          },
          {
            sentence: 'When ___ you ___ in Moscow?',
            ru: 'Когда ты приехал(а) в Москву?',
            answer: 'did ... arrive',
            options: ['did ... arrive', 'have ... arrived', 'were ... arriving', 'do ... arrive'],
            signalWords: ['When'],
            explanation: 'Past Simple с вопросительным словом When для конкретного момента в прошлом.',
          },
        ],
      },
    ],
  },

  // ─── Past Continuous ──────────────────────────────────────────
  {
    tense: 'past_continuous',
    defaultDifficulty: 2,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'I ___ TV when the phone rang.',
            ru: 'Я смотрел(а) телевизор, когда зазвонил телефон.',
            answer: 'was watching',
            options: ['was watching', 'watched', 'have watched', 'am watching'],
            signalWords: ['when'],
            explanation: 'Past Continuous для фонового действия, прерванного другим событием. Сигнал: when + Past Simple.',
          },
          {
            sentence: 'At 8 p.m. yesterday, they ___ dinner.',
            ru: 'Вчера в 8 вечера они ужинали.',
            answer: 'were having',
            options: ['were having', 'had', 'have had', 'are having'],
            signalWords: ['At 8 p.m. yesterday'],
            explanation: 'Past Continuous для действия, происходившего в конкретный момент в прошлом. Сигнал: At 8 p.m. yesterday.',
          },
          {
            sentence: 'She ___ while he ___ breakfast.',
            ru: 'Она спала, пока он готовил завтрак.',
            answer: 'was sleeping ... was cooking',
            options: ['was sleeping ... was cooking', 'slept ... cooked', 'has slept ... cooked', 'sleeps ... cooks'],
            signalWords: ['while'],
            explanation: 'Past Continuous для двух одновременных действий в прошлом. Сигнал: while.',
          },
          {
            sentence: 'The sun ___ when we left the house.',
            ru: 'Солнце светило, когда мы вышли из дома.',
            answer: 'was shining',
            options: ['was shining', 'shone', 'has been shining', 'is shining'],
            signalWords: ['when'],
            explanation: 'Past Continuous для описания обстановки (фона) при прерывающем действии.',
          },
          {
            sentence: 'He ___ to work when the accident happened.',
            ru: 'Он ехал на работу, когда произошла авария.',
            answer: 'was driving',
            options: ['was driving', 'drove', 'has driven', 'is driving'],
            signalWords: ['when'],
            explanation: 'Past Continuous для длительного действия, прерванного внезапным событием. Сигнал: when + Past Simple.',
          },
          {
            sentence: 'All evening, the children ___ in the garden.',
            ru: 'Весь вечер дети играли в саду.',
            answer: 'were playing',
            options: ['were playing', 'played', 'have played', 'play'],
            signalWords: ['All evening'],
            explanation: 'Past Continuous для длительного действия в течение определённого периода. Сигнал: All evening.',
          },
        ],
      },
      {
        form: 'negative',
        exercises: [
          {
            sentence: 'I ___ when the teacher explained the rule.',
            ru: 'Я не слушал(а), когда учитель объяснял правило.',
            answer: 'wasn\'t listening',
            options: ['wasn\'t listening', 'didn\'t listen', 'haven\'t listened', 'don\'t listen'],
            signalWords: ['when'],
            explanation: 'Past Continuous для фонового действия (не слушал) при другом событии.',
          },
        ],
      },
      {
        form: 'question',
        exercises: [
          {
            sentence: 'What ___ you ___ at 3 o\'clock yesterday?',
            ru: 'Что ты делал(а) вчера в 3 часа?',
            answer: 'were ... doing',
            options: ['were ... doing', 'did ... do', 'have ... done', 'are ... doing'],
            signalWords: ['at 3 o\'clock yesterday'],
            explanation: 'Past Continuous для вопроса о действии в конкретный момент прошлого.',
          },
        ],
      },
    ],
  },

  // ─── Past Perfect ──────────────────────────────────────────
  {
    tense: 'past_perfect',
    defaultDifficulty: 2,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'By the time I arrived, the movie ___.',
            ru: 'К моему приходу фильм уже начался.',
            answer: 'had already started',
            options: ['had already started', 'already started', 'was already starting', 'has already started'],
            signalWords: ['By the time', 'already'],
            explanation: 'Past Perfect для действия, завершённого до другого действия в прошлом. Сигнал: By the time.',
          },
          {
            sentence: 'She ___ before that trip.',
            ru: 'До той поездки она никогда не летала.',
            answer: 'had never flown',
            options: ['had never flown', 'never flew', 'has never flown', 'was never flying'],
            signalWords: ['before', 'never'],
            explanation: 'Past Perfect для опыта до определённого момента в прошлом. Сигнал: before.',
          },
          {
            sentence: 'After they ___, they went for a walk.',
            ru: 'После того как они поели, они пошли гулять.',
            answer: 'had eaten',
            options: ['had eaten', 'ate', 'were eating', 'have eaten'],
            signalWords: ['After'],
            explanation: 'Past Perfect для первого из двух последовательных действий в прошлом. Сигнал: After.',
          },
          {
            sentence: 'He ___ his wallet, so he couldn\'t pay.',
            ru: 'Он потерял кошелёк, поэтому не мог заплатить.',
            answer: 'had lost',
            options: ['had lost', 'lost', 'was losing', 'has lost'],
            explanation: 'Past Perfect для причины, предшествующей результату в прошлом (потерял → не мог заплатить).',
            difficulty: 3,
          },
          {
            sentence: 'I realized I ___ my keys at home.',
            ru: 'Я понял(а), что забыл(а) ключи дома.',
            answer: 'had forgotten',
            options: ['had forgotten', 'forgot', 'was forgetting', 'have forgotten'],
            explanation: 'Past Perfect для действия, произошедшего раньше момента осознания (realized).',
          },
          {
            sentence: 'The train ___ by the time we got to the station.',
            ru: 'Поезд уехал к тому времени, как мы добрались до станции.',
            answer: 'had left',
            options: ['had left', 'left', 'was leaving', 'has left'],
            signalWords: ['by the time'],
            explanation: 'Past Perfect для действия, завершённого до другого момента в прошлом. Сигнал: by the time.',
          },
          {
            sentence: 'When I got home, my family ___ dinner.',
            ru: 'Когда я пришёл домой, семья уже поужинала.',
            answer: 'had already had',
            options: ['had already had', 'already had', 'were already having', 'have already had'],
            signalWords: ['already', 'When'],
            explanation: 'Past Perfect для действия, завершённого до другого события в прошлом. Сигнал: already.',
            difficulty: 3,
          },
        ],
      },
      {
        form: 'negative',
        exercises: [
          {
            sentence: 'They ___ the project before the deadline.',
            ru: 'Они не закончили проект до дедлайна.',
            answer: 'hadn\'t finished',
            options: ['hadn\'t finished', 'didn\'t finish', 'weren\'t finishing', 'haven\'t finished'],
            signalWords: ['before'],
            explanation: 'Past Perfect для действия, не завершённого до определённого момента в прошлом. Сигнал: before.',
          },
        ],
      },
      { form: 'question', exercises: [] },
    ],
  },

  // ─── Past Perfect Continuous ──────────────────────────────────────────
  {
    tense: 'past_perfect_continuous',
    defaultDifficulty: 3,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'She ___ for two hours before the bus finally came.',
            ru: 'Она ждала два часа, прежде чем автобус наконец приехал.',
            answer: 'had been waiting',
            options: ['had been waiting', 'was waiting', 'waited', 'has been waiting'],
            signalWords: ['for two hours', 'before'],
            explanation: 'Past Perfect Continuous для длительного действия до другого момента в прошлом. Сигнал: for + before.',
          },
          {
            sentence: 'He was tired because he ___ all day.',
            ru: 'Он устал, потому что работал весь день.',
            answer: 'had been working',
            options: ['had been working', 'was working', 'worked', 'has been working'],
            signalWords: ['all day'],
            explanation: 'Past Perfect Continuous для длительного действия, ставшего причиной состояния в прошлом.',
          },
          {
            sentence: 'They ___ in London for five years before they moved to Paris.',
            ru: 'Они жили в Лондоне пять лет, прежде чем переехали в Париж.',
            answer: 'had been living',
            options: ['had been living', 'were living', 'lived', 'have been living'],
            signalWords: ['for five years', 'before'],
            explanation: 'Past Perfect Continuous для действия, длившегося до определённого события в прошлом. Сигнал: for + before.',
          },
          {
            sentence: 'The ground was wet. It ___.',
            ru: 'Земля была мокрая. Шёл дождь.',
            answer: 'had been raining',
            options: ['had been raining', 'was raining', 'rained', 'has been raining'],
            explanation: 'Past Perfect Continuous для объяснения видимого результата в прошлом (земля мокрая, потому что шёл дождь).',
          },
          {
            sentence: 'I ___ for three hours when my friend called.',
            ru: 'Я учился три часа, когда позвонил друг.',
            answer: 'had been studying',
            options: ['had been studying', 'was studying', 'studied', 'have been studying'],
            signalWords: ['for three hours', 'when'],
            explanation: 'Past Perfect Continuous для длительного действия до прерывающего события. Сигнал: for + when.',
          },
          {
            sentence: 'Her eyes were red. She ___.',
            ru: 'У неё были красные глаза. Она плакала.',
            answer: 'had been crying',
            options: ['had been crying', 'was crying', 'cried', 'has been crying'],
            explanation: 'Past Perfect Continuous для объяснения видимого результата в прошлом (красные глаза).',
          },
          {
            sentence: 'We ___ for 10 hours when we finally reached the hotel.',
            ru: 'Мы ехали 10 часов, когда наконец добрались до отеля.',
            answer: 'had been traveling',
            options: ['had been traveling', 'were traveling', 'traveled', 'have been traveling'],
            signalWords: ['for 10 hours', 'when'],
            explanation: 'Past Perfect Continuous для длительного действия до момента завершения. Сигнал: for + when.',
          },
          {
            sentence: 'By the time the guests arrived, we ___ for three hours.',
            ru: 'К приходу гостей мы готовили три часа.',
            answer: 'had been cooking',
            options: ['had been cooking', 'were cooking', 'cooked', 'have been cooking'],
            signalWords: ['By the time', 'for three hours'],
            explanation: 'Past Perfect Continuous для длительного действия до момента в прошлом. Сигнал: By the time + for.',
          },
        ],
      },
      { form: 'negative', exercises: [] },
      { form: 'question', exercises: [] },
    ],
  },

  // ─── Future Simple (will) ──────────────────────────────────────────
  {
    tense: 'future_simple',
    defaultDifficulty: 1,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'I think it ___ tomorrow.',
            ru: 'Думаю, завтра будет дождь.',
            answer: 'will rain',
            options: ['will rain', 'is raining', 'rains', 'is going to rain'],
            signalWords: ['I think', 'tomorrow'],
            explanation: 'Future Simple (will) для предположений. Сигнал: I think.',
          },
          {
            sentence: 'She ___ 30 next year.',
            ru: 'В следующем году ей будет 30.',
            answer: 'will be',
            options: ['will be', 'is being', 'is', 'is going to be'],
            signalWords: ['next year'],
            explanation: 'Future Simple для фактов о будущем. Сигнал: next year.',
          },
          {
            sentence: 'Don\'t worry, I ___ you with the project.',
            ru: 'Не волнуйся, я помогу тебе с проектом.',
            answer: 'will help',
            options: ['will help', 'am helping', 'help', 'am going to help'],
            explanation: 'Future Simple (will) для спонтанных решений и обещаний.',
          },
          {
            sentence: 'It\'s cold. I ___ the window.',
            ru: 'Холодно. Я закрою окно.',
            answer: 'will close',
            options: ['will close', 'am closing', 'close', 'am going to close'],
            explanation: 'Future Simple (will) для спонтанного решения прямо сейчас.',
          },
          {
            sentence: 'One day, people ___ on Mars.',
            ru: 'Однажды люди будут жить на Марсе.',
            answer: 'will live',
            options: ['will live', 'are living', 'live', 'are going to live'],
            signalWords: ['One day'],
            explanation: 'Future Simple для предсказаний о далёком будущем. Сигнал: One day.',
          },
        ],
      },
      {
        form: 'negative',
        exercises: [
          {
            sentence: 'I promise I ___ anyone your secret.',
            ru: 'Обещаю, я никому не расскажу твой секрет.',
            answer: 'won\'t tell',
            options: ['won\'t tell', 'am not telling', 'don\'t tell', 'am not going to tell'],
            signalWords: ['promise'],
            explanation: 'Future Simple (will) для обещаний. Сигнал: I promise.',
          },
          {
            sentence: 'He probably ___ to the party.',
            ru: 'Он, наверное, не придёт на вечеринку.',
            answer: 'won\'t come',
            options: ['won\'t come', 'isn\'t coming', 'doesn\'t come', 'isn\'t going to come'],
            signalWords: ['probably'],
            explanation: 'Future Simple (will) для предположений. Сигнал: probably.',
          },
        ],
      },
      {
        form: 'question',
        exercises: [
          {
            sentence: '___ you ___ me?',
            ru: 'Ты выйдешь за меня?',
            answer: 'Will ... marry',
            options: ['Will ... marry', 'Are ... marrying', 'Do ... marry', 'Are ... going to marry'],
            explanation: 'Future Simple (will) для предложений и просьб.',
          },
        ],
      },
    ],
  },

  // ─── Future Simple (be going to) ──────────────────────────────────────────
  {
    tense: 'future_going_to',
    defaultDifficulty: 2,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'Look at those clouds! It ___.',
            ru: 'Посмотри на эти тучи! Будет дождь.',
            answer: 'is going to rain',
            options: ['is going to rain', 'will rain', 'rains', 'is raining'],
            signalWords: ['Look at those clouds'],
            explanation: 'Going to для предсказаний на основе очевидных признаков. Сигнал: визуальное доказательство (тучи).',
          },
          {
            sentence: 'We ___ our grandparents this weekend.',
            ru: 'Мы собираемся навестить бабушку и дедушку в эти выходные.',
            answer: 'are going to visit',
            options: ['are going to visit', 'will visit', 'visit', 'visited'],
            signalWords: ['this weekend'],
            explanation: 'Going to для заранее запланированных действий.',
          },
          {
            sentence: 'She ___ a new job next month. She\'s already signed the contract.',
            ru: 'Она начнёт новую работу в следующем месяце. Контракт уже подписан.',
            answer: 'is going to start',
            options: ['is going to start', 'will start', 'starts', 'is starting'],
            signalWords: ['next month'],
            explanation: 'Going to для запланированного действия (контракт уже подписан).',
          },
          {
            sentence: 'Be careful! You ___!',
            ru: 'Осторожно! Ты упадёшь!',
            answer: 'are going to fall',
            options: ['are going to fall', 'will fall', 'fall', 'are falling'],
            signalWords: ['Be careful'],
            explanation: 'Going to для предсказания на основе текущей ситуации (видно, что человек сейчас упадёт).',
          },
          {
            sentence: 'I ___ a new car. I\'ve been saving up.',
            ru: 'Я собираюсь купить новую машину. Я копил(а).',
            answer: 'am going to buy',
            options: ['am going to buy', 'will buy', 'buy', 'am buying'],
            explanation: 'Going to для намерения, принятого заранее (уже копил деньги).',
          },
          {
            sentence: 'They ___ a new school in our neighborhood.',
            ru: 'В нашем районе собираются построить новую школу.',
            answer: 'are going to build',
            options: ['are going to build', 'will build', 'build', 'are building'],
            explanation: 'Going to для запланированных проектов и решений.',
          },
        ],
      },
      {
        form: 'negative',
        exercises: [
          {
            sentence: 'He ___ the exam. He hasn\'t studied at all.',
            ru: 'Он не сдаст экзамен. Он совсем не учился.',
            answer: 'isn\'t going to pass',
            options: ['isn\'t going to pass', 'won\'t pass', 'doesn\'t pass', 'isn\'t passing'],
            explanation: 'Going to для предсказания на основе текущих фактов (не учился → не сдаст).',
          },
        ],
      },
      {
        form: 'question',
        exercises: [
          {
            sentence: 'What ___ you ___ after graduation?',
            ru: 'Что ты собираешься делать после окончания учёбы?',
            answer: 'are ... going to do',
            options: ['are ... going to do', 'will ... do', 'do ... do', 'are ... doing'],
            signalWords: ['after graduation'],
            explanation: 'Going to для планов на будущее.',
          },
        ],
      },
    ],
  },

  // ─── Future Continuous ──────────────────────────────────────────
  {
    tense: 'future_continuous',
    defaultDifficulty: 3,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'This time tomorrow, I ___ to London.',
            ru: 'Завтра в это время я буду лететь в Лондон.',
            answer: 'will be flying',
            options: ['will be flying', 'will fly', 'am flying', 'fly'],
            signalWords: ['This time tomorrow'],
            explanation: 'Future Continuous для действия, которое будет в процессе в определённый момент будущего. Сигнал: This time tomorrow.',
          },
          {
            sentence: 'At 10 a.m. tomorrow, she ___ her exam.',
            ru: 'Завтра в 10 утра она будет сдавать экзамен.',
            answer: 'will be taking',
            options: ['will be taking', 'will take', 'takes', 'is taking'],
            signalWords: ['At 10 a.m. tomorrow'],
            explanation: 'Future Continuous для действия в конкретный момент в будущем. Сигнал: At 10 a.m. tomorrow.',
          },
          {
            sentence: 'Don\'t call me at 9. I ___.',
            ru: 'Не звони мне в 9. Я буду спать.',
            answer: 'will be sleeping',
            options: ['will be sleeping', 'will sleep', 'am sleeping', 'sleep'],
            signalWords: ['at 9'],
            explanation: 'Future Continuous для действия, которое будет в процессе в определённое время.',
          },
          {
            sentence: 'They ___ for you when you arrive.',
            ru: 'Они будут ждать тебя, когда ты приедешь.',
            answer: 'will be waiting',
            options: ['will be waiting', 'will wait', 'wait', 'are waiting'],
            signalWords: ['when you arrive'],
            explanation: 'Future Continuous для длительного действия, которое будет происходить к моменту другого события.',
          },
          {
            sentence: 'This time next week, we ___ on the beach.',
            ru: 'На следующей неделе в это время мы будем лежать на пляже.',
            answer: 'will be lying',
            options: ['will be lying', 'will lie', 'are lying', 'lie'],
            signalWords: ['This time next week'],
            explanation: 'Future Continuous для действия в процессе в будущем. Сигнал: This time next week.',
          },
          {
            sentence: 'I ___ late tomorrow, so don\'t wait for me.',
            ru: 'Завтра я буду работать допоздна, так что не жди меня.',
            answer: 'will be working',
            options: ['will be working', 'will work', 'work', 'am working'],
            signalWords: ['tomorrow'],
            explanation: 'Future Continuous для запланированного длительного действия в будущем.',
          },
        ],
      },
      { form: 'negative', exercises: [] },
      {
        form: 'question',
        exercises: [
          {
            sentence: '___ you ___ the car tomorrow evening?',
            ru: 'Ты будешь пользоваться машиной завтра вечером?',
            answer: 'Will ... be using',
            options: ['Will ... be using', 'Will ... use', 'Do ... use', 'Are ... using'],
            signalWords: ['tomorrow evening'],
            explanation: 'Future Continuous для вежливого вопроса о планах.',
          },
        ],
      },
    ],
  },

  // ─── Future Perfect ──────────────────────────────────────────
  {
    tense: 'future_perfect',
    defaultDifficulty: 3,
    forms: [
      {
        form: 'affirmative',
        exercises: [
          {
            sentence: 'By next year, I ___ from university.',
            ru: 'К следующему году я окончу университет.',
            answer: 'will have graduated',
            options: ['will have graduated', 'will graduate', 'am graduating', 'graduate'],
            signalWords: ['By next year'],
            explanation: 'Future Perfect для действия, которое будет завершено до определённого момента в будущем. Сигнал: By next year.',
          },
          {
            sentence: 'She ___ the report by 5 p.m.',
            ru: 'Она закончит отчёт к 5 часам.',
            answer: 'will have finished',
            options: ['will have finished', 'will finish', 'finishes', 'is finishing'],
            signalWords: ['by 5 p.m.'],
            explanation: 'Future Perfect для действия, завершённого к определённому моменту. Сигнал: by 5 p.m.',
          },
          {
            sentence: 'By the time you arrive, we ___.',
            ru: 'К тому времени, как ты приедешь, мы уже уедем.',
            answer: 'will have already left',
            options: ['will have already left', 'will already leave', 'already leave', 'are already leaving'],
            signalWords: ['By the time', 'already'],
            explanation: 'Future Perfect для действия, завершённого до другого будущего момента. Сигнал: By the time.',
          },
          {
            sentence: 'In two months, they ___ married for 25 years.',
            ru: 'Через два месяца они будут женаты 25 лет.',
            answer: 'will have been',
            options: ['will have been', 'will be', 'are', 'have been'],
            signalWords: ['In two months'],
            explanation: 'Future Perfect для длительности к определённому моменту в будущем. Сигнал: In two months.',
          },
          {
            sentence: 'He ___ enough money by December to buy a car.',
            ru: 'К декабрю он накопит достаточно денег, чтобы купить машину.',
            answer: 'will have saved',
            options: ['will have saved', 'will save', 'saves', 'is saving'],
            signalWords: ['by December'],
            explanation: 'Future Perfect для результата, достигнутого к определённому моменту. Сигнал: by December.',
          },
          {
            sentence: 'By the end of this course, you ___ 500 new words.',
            ru: 'К концу этого курса вы выучите 500 новых слов.',
            answer: 'will have learned',
            options: ['will have learned', 'will learn', 'learn', 'are learning'],
            signalWords: ['By the end of'],
            explanation: 'Future Perfect для достижения результата к определённому моменту. Сигнал: By the end of.',
          },
        ],
      },
      { form: 'negative', exercises: [] },
      {
        form: 'question',
        exercises: [
          {
            sentence: '___ you ___ the book by Monday?',
            ru: 'Ты прочитаешь книгу к понедельнику?',
            answer: 'Will ... have read',
            options: ['Will ... have read', 'Will ... read', 'Do ... read', 'Are ... reading'],
            signalWords: ['by Monday'],
            explanation: 'Future Perfect для вопроса о завершении к определённому сроку. Сигнал: by Monday.',
          },
        ],
      },
    ],
  },
];

// ─── Public export (API contract preserved) ───────────────────────────────────

export const TENSE_EXERCISES: TenseExercise[] = buildExercises(TENSE_DATA);
