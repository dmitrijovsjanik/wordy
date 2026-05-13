export type FormulaPartRole =
  | 'subject'
  | 'auxiliary'
  | 'main-verb'
  | 'ending'
  | 'connector'
  | 'punctuation'
  | 'plain';

export type FormulaPart = {
  text: string;
  role: FormulaPartRole;
};

export type ExampleSentence = {
  parts: FormulaPart[];
  translation: string;
  note?: string; // e.g. "правильный глагол" / "неправильный глагол"
};

export type SentenceForm = {
  label: string;
  formula: FormulaPart[];
  examples: ExampleSentence[];
};

export type TenseGroup = 'present' | 'past' | 'future';

export type TenseReferenceItem = {
  id: string;
  name: string;
  group: TenseGroup;
  shortDescription: string;
  forms: SentenceForm[];
  signalWords: string[];
  usageTip: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const s = (text: string): FormulaPart => ({ text, role: 'subject' });
const a = (text: string): FormulaPart => ({ text, role: 'auxiliary' });
const v = (text: string): FormulaPart => ({ text, role: 'main-verb' });
const e = (text: string): FormulaPart => ({ text, role: 'ending' });
const p = (text: string): FormulaPart => ({ text, role: 'plain' });

// Formula-only helpers (uppercase for formulas)
const S = (text: string): FormulaPart => ({ text, role: 'subject' });
const A = (text: string): FormulaPart => ({ text, role: 'auxiliary' });
const V = (text: string): FormulaPart => ({ text, role: 'main-verb' });
const E = (text: string): FormulaPart => ({ text, role: 'ending' });
const C: FormulaPart = { text: ' + ', role: 'connector' };
const Q: FormulaPart = { text: '?', role: 'punctuation' };

// ─── Data ─────────────────────────────────────────────────────────────────────

export const TENSE_REFERENCE_DATA: TenseReferenceItem[] = [
  // ═══════════════════════════════ PRESENT ═══════════════════════════════════
  {
    id: 'present_simple',
    name: 'Present Simple',
    group: 'present',
    shortDescription: 'Регулярные действия, факты, привычки',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, V('V'), E('(-s/-es)')],
        examples: [
          {
            parts: [s('She '), v('play'), e('s'), p(' tennis every Sunday.')],
            translation: 'Она играет в теннис каждое воскресенье.',
            note: 'правильный глагол',
          },
          {
            parts: [s('He '), v('go'), e('es'), p(' to work by bus.')],
            translation: 'Он ездит на работу на автобусе.',
            note: 'неправильный глагол',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('do/does'), C, A('not'), C, V('V')],
        examples: [
          {
            parts: [s('She '), a("doesn't "), v('play'), p(' tennis.')],
            translation: 'Она не играет в теннис.',
          },
          {
            parts: [s('They '), a("don't "), v('go'), p(' to school on Sunday.')],
            translation: 'Они не ходят в школу в воскресенье.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Do/Does'), C, S('S'), C, V('V'), Q],
        examples: [
          {
            parts: [a('Does '), s('she '), v('play'), p(' tennis?')],
            translation: 'Она играет в теннис?',
          },
          {
            parts: [a('Do '), s('you '), v('speak'), p(' English?')],
            translation: 'Ты говоришь по-английски?',
          },
        ],
      },
    ],
    signalWords: ['always', 'usually', 'often', 'sometimes', 'never', 'every day'],
    usageTip: 'В 3-м лице ед. числа (he/she/it) добавляется -s/-es к глаголу.',
  },
  {
    id: 'present_continuous',
    name: 'Present Continuous',
    group: 'present',
    shortDescription: 'Действие происходит прямо сейчас',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('am/is/are'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('She '), a('is '), v('read'), e('ing'), p(' a book now.')],
            translation: 'Она сейчас читает книгу.',
          },
          {
            parts: [s('They '), a('are '), v('runn'), e('ing'), p(' in the park.')],
            translation: 'Они бегут в парке.',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('am/is/are'), C, A('not'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('She '), a('is not '), v('read'), e('ing'), p(' a book.')],
            translation: 'Она не читает книгу.',
          },
          {
            parts: [s('I '), a("'m not "), v('work'), e('ing'), p(' today.')],
            translation: 'Я не работаю сегодня.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Am/Is/Are'), C, S('S'), C, V('V'), E('-ing'), Q],
        examples: [
          {
            parts: [a('Is '), s('she '), v('read'), e('ing'), p(' a book?')],
            translation: 'Она читает книгу?',
          },
          {
            parts: [a('Are '), s('you '), v('wait'), e('ing'), p(' for me?')],
            translation: 'Ты ждёшь меня?',
          },
        ],
      },
    ],
    signalWords: ['now', 'right now', 'at the moment', 'currently', 'look!', 'listen!'],
    usageTip: 'Некоторые глаголы не используются в Continuous: know, like, want, need.',
  },
  {
    id: 'present_perfect',
    name: 'Present Perfect',
    group: 'present',
    shortDescription: 'Результат прошлого действия важен сейчас',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('have/has'), C, V('V3')],
        examples: [
          {
            parts: [s('I '), a('have '), v('visited'), p(' London twice.')],
            translation: 'Я дважды был в Лондоне.',
            note: 'правильный: visit → visited',
          },
          {
            parts: [s('She '), a('has '), v('written'), p(' three letters.')],
            translation: 'Она написала три письма.',
            note: 'неправильный: write → written',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('have/has'), C, A('not'), C, V('V3')],
        examples: [
          {
            parts: [s('I '), a("haven't "), v('finished'), p(' yet.')],
            translation: 'Я ещё не закончил.',
            note: 'правильный: finish → finished',
          },
          {
            parts: [s('He '), a("hasn't "), v('seen'), p(' this film.')],
            translation: 'Он не видел этот фильм.',
            note: 'неправильный: see → seen',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Have/Has'), C, S('S'), C, V('V3'), Q],
        examples: [
          {
            parts: [a('Have '), s('you '), v('played'), p(' this game?')],
            translation: 'Ты играл в эту игру?',
            note: 'правильный: play → played',
          },
          {
            parts: [a('Has '), s('she '), v('gone'), p(' home?')],
            translation: 'Она ушла домой?',
            note: 'неправильный: go → gone',
          },
        ],
      },
    ],
    signalWords: ['already', 'just', 'yet', 'ever', 'never', 'since', 'for', 'recently'],
    usageTip: 'V3 — третья форма глагола (past participle): done, seen, written.',
  },
  {
    id: 'present_perfect_continuous',
    name: 'Present Perfect Continuous',
    group: 'present',
    shortDescription: 'Действие началось в прошлом и продолжается',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('have/has been'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('She '), a('has been '), v('work'), e('ing'), p(' here for 5 years.')],
            translation: 'Она работает здесь 5 лет (и продолжает).',
          },
          {
            parts: [s('I '), a('have been '), v('learn'), e('ing'), p(' English since March.')],
            translation: 'Я учу английский с марта.',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('have/has'), C, A('not'), C, A('been'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('She '), a("hasn't been "), v('sleep'), e('ing'), p(' well lately.')],
            translation: 'Она плохо спит в последнее время.',
          },
          {
            parts: [s('We '), a("haven't been "), v('wait'), e('ing'), p(' long.')],
            translation: 'Мы не ждали долго.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Have/Has'), C, S('S'), C, A('been'), C, V('V'), E('-ing'), Q],
        examples: [
          {
            parts: [a('Has '), s('she '), a('been '), v('work'), e('ing'), p(' here long?')],
            translation: 'Она давно здесь работает?',
          },
          {
            parts: [p('How long '), a('have '), s('you '), a('been '), v('wait'), e('ing'), p('?')],
            translation: 'Как давно ты ждёшь?',
          },
        ],
      },
    ],
    signalWords: ['for', 'since', 'how long', 'all day', 'lately', 'recently'],
    usageTip: 'Акцент на длительности процесса, а не на результате.',
  },

  // ═══════════════════════════════ PAST ════════════════════════════════════════
  {
    id: 'past_simple',
    name: 'Past Simple',
    group: 'past',
    shortDescription: 'Завершённое действие в прошлом',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, V('V2'), E('(-ed)')],
        examples: [
          {
            parts: [s('They '), v('visit'), e('ed'), p(' Paris last summer.')],
            translation: 'Они посетили Париж прошлым летом.',
            note: 'правильный: visit → visited',
          },
          {
            parts: [s('She '), v('went'), p(' to the cinema yesterday.')],
            translation: 'Она ходила в кино вчера.',
            note: 'неправильный: go → went',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('did'), C, A('not'), C, V('V')],
        examples: [
          {
            parts: [s('They '), a("didn't "), v('visit'), p(' Paris.')],
            translation: 'Они не посещали Париж.',
          },
          {
            parts: [s('She '), a("didn't "), v('go'), p(' to the cinema.')],
            translation: 'Она не ходила в кино.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Did'), C, S('S'), C, V('V'), Q],
        examples: [
          {
            parts: [a('Did '), s('they '), v('visit'), p(' Paris?')],
            translation: 'Они посещали Париж?',
          },
          {
            parts: [a('Did '), s('she '), v('go'), p(' to the cinema?')],
            translation: 'Она ходила в кино?',
          },
        ],
      },
    ],
    signalWords: ['yesterday', 'last week', 'ago', 'in 2020', 'when', 'then'],
    usageTip: 'V2 — вторая форма глагола. Правильные: +ed. Неправильные: go→went, see→saw.',
  },
  {
    id: 'past_continuous',
    name: 'Past Continuous',
    group: 'past',
    shortDescription: 'Действие длилось в определённый момент в прошлом',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('was/were'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('I '), a('was '), v('watch'), e('ing'), p(' TV at 8 pm.')],
            translation: 'Я смотрел телевизор в 8 вечера.',
          },
          {
            parts: [s('They '), a('were '), v('play'), e('ing'), p(' football when it started to rain.')],
            translation: 'Они играли в футбол, когда начался дождь.',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('was/were'), C, A('not'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('I '), a("wasn't "), v('watch'), e('ing'), p(' TV.')],
            translation: 'Я не смотрел телевизор.',
          },
          {
            parts: [s('They '), a("weren't "), v('listen'), e('ing'), p(' to the teacher.')],
            translation: 'Они не слушали учителя.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Was/Were'), C, S('S'), C, V('V'), E('-ing'), Q],
        examples: [
          {
            parts: [a('Were '), s('you '), v('watch'), e('ing'), p(' TV?')],
            translation: 'Ты смотрел телевизор?',
          },
          {
            parts: [p('What '), a('were '), s('they '), v('do'), e('ing'), p(' at that moment?')],
            translation: 'Что они делали в тот момент?',
          },
        ],
      },
    ],
    signalWords: ['at that moment', 'while', 'when', 'all day yesterday', 'at 5 o\'clock'],
    usageTip: 'Часто используется с when/while для описания фона событий.',
  },
  {
    id: 'past_perfect',
    name: 'Past Perfect',
    group: 'past',
    shortDescription: 'Действие завершилось до другого действия в прошлом',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('had'), C, V('V3')],
        examples: [
          {
            parts: [s('She '), a('had '), v('finished'), p(' before I arrived.')],
            translation: 'Она закончила до моего прихода.',
            note: 'правильный: finish → finished',
          },
          {
            parts: [s('He '), a('had '), v('eaten'), p(' lunch before the meeting.')],
            translation: 'Он пообедал до встречи.',
            note: 'неправильный: eat → eaten',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('had'), C, A('not'), C, V('V3')],
        examples: [
          {
            parts: [s('She '), a("hadn't "), v('finished'), p(' yet.')],
            translation: 'Она ещё не закончила.',
          },
          {
            parts: [s('I '), a("hadn't "), v('seen'), p(' him before the party.')],
            translation: 'Я не видел его до вечеринки.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Had'), C, S('S'), C, V('V3'), Q],
        examples: [
          {
            parts: [a('Had '), s('she '), v('finished'), p(' before you arrived?')],
            translation: 'Она закончила до твоего прихода?',
          },
          {
            parts: [a('Had '), s('they '), v('met'), p(' before?')],
            translation: 'Они встречались раньше?',
          },
        ],
      },
    ],
    signalWords: ['before', 'after', 'by the time', 'already', 'just', 'never'],
    usageTip: 'Это «прошлое в прошлом» — событие, которое произошло раньше другого.',
  },
  {
    id: 'past_perfect_continuous',
    name: 'Past Perfect Continuous',
    group: 'past',
    shortDescription: 'Длительное действие до другого момента в прошлом',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('had been'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('They '), a('had been '), v('wait'), e('ing'), p(' for 2 hours.')],
            translation: 'Они ждали уже 2 часа (к тому моменту).',
          },
          {
            parts: [s('She '), a('had been '), v('teach'), e('ing'), p(' for 10 years before she retired.')],
            translation: 'Она преподавала 10 лет, прежде чем ушла на пенсию.',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('had'), C, A('not'), C, A('been'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('They '), a("hadn't been "), v('wait'), e('ing'), p(' long.')],
            translation: 'Они не ждали долго.',
          },
          {
            parts: [s('I '), a("hadn't been "), v('sleep'), e('ing'), p(' well before the trip.')],
            translation: 'Я плохо спал перед поездкой.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Had'), C, S('S'), C, A('been'), C, V('V'), E('-ing'), Q],
        examples: [
          {
            parts: [a('Had '), s('they '), a('been '), v('wait'), e('ing'), p(' long?')],
            translation: 'Они долго ждали?',
          },
          {
            parts: [p('How long '), a('had '), s('she '), a('been '), v('study'), e('ing'), p(' English?')],
            translation: 'Как давно она учила английский?',
          },
        ],
      },
    ],
    signalWords: ['for', 'since', 'how long', 'before', 'by the time'],
    usageTip: 'Подчёркивает длительность процесса до определённого момента в прошлом.',
  },

  // ═══════════════════════════════ FUTURE ══════════════════════════════════════
  {
    id: 'future_simple',
    name: 'Future Simple (will)',
    group: 'future',
    shortDescription: 'Спонтанные решения, предсказания, обещания',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('will'), C, V('V')],
        examples: [
          {
            parts: [s('I '), a('will '), v('help'), p(' you tomorrow.')],
            translation: 'Я помогу тебе завтра.',
          },
          {
            parts: [s('She '), a('will '), v('come'), p(' to the party.')],
            translation: 'Она придёт на вечеринку.',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('will'), C, A('not'), C, V('V')],
        examples: [
          {
            parts: [s('I '), a("won't "), v('forget'), p(' this.')],
            translation: 'Я не забуду это.',
          },
          {
            parts: [s('He '), a("won't "), v('tell'), p(' anyone.')],
            translation: 'Он никому не расскажет.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Will'), C, S('S'), C, V('V'), Q],
        examples: [
          {
            parts: [a('Will '), s('you '), v('come'), p(' to the party?')],
            translation: 'Ты придёшь на вечеринку?',
          },
          {
            parts: [a('Will '), s('it '), v('rain'), p(' tomorrow?')],
            translation: 'Завтра будет дождь?',
          },
        ],
      },
    ],
    signalWords: ['tomorrow', 'next week', 'soon', 'I think', 'probably', 'perhaps'],
    usageTip: "Won't = will not. Для спонтанных решений: «I'll take this one!»",
  },
  {
    id: 'future_going_to',
    name: 'Future Simple (be going to)',
    group: 'future',
    shortDescription: 'Запланированные действия, очевидные предсказания',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('am/is/are going to'), C, V('V')],
        examples: [
          {
            parts: [s('We '), a('are going to '), v('move'), p(' next month.')],
            translation: 'Мы собираемся переехать в следующем месяце.',
          },
          {
            parts: [s('She '), a('is going to '), v('buy'), p(' a new car.')],
            translation: 'Она собирается купить новую машину.',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('am/is/are'), C, A('not'), C, A('going to'), C, V('V')],
        examples: [
          {
            parts: [s('I '), a("'m not going to "), v('buy'), p(' it.')],
            translation: 'Я не собираюсь покупать это.',
          },
          {
            parts: [s('They '), a("aren't going to "), v('change'), p(' the plan.')],
            translation: 'Они не собираются менять план.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Am/Is/Are'), C, S('S'), C, A('going to'), C, V('V'), Q],
        examples: [
          {
            parts: [a('Are '), s('you '), a('going to '), v('travel'), p(' this summer?')],
            translation: 'Ты собираешься путешествовать этим летом?',
          },
          {
            parts: [a('Is '), s('she '), a('going to '), v('study'), p(' abroad?')],
            translation: 'Она собирается учиться за границей?',
          },
        ],
      },
    ],
    signalWords: ['tonight', 'this weekend', 'next year', 'soon', 'plan'],
    usageTip: 'Для планов используйте going to, для спонтанных решений — will.',
  },
  {
    id: 'future_continuous',
    name: 'Future Continuous',
    group: 'future',
    shortDescription: 'Действие будет длиться в определённый момент в будущем',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('will be'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('I '), a('will be '), v('work'), e('ing'), p(' at 5 pm.')],
            translation: 'Я буду работать в 5 вечера.',
          },
          {
            parts: [s('They '), a('will be '), v('fly'), e('ing'), p(' to London at this time tomorrow.')],
            translation: 'Они будут лететь в Лондон в это время завтра.',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('will'), C, A('not'), C, A('be'), C, V('V'), E('-ing')],
        examples: [
          {
            parts: [s('I '), a("won't be "), v('work'), e('ing'), p(' tomorrow.')],
            translation: 'Я не буду работать завтра.',
          },
          {
            parts: [s('She '), a("won't be "), v('wait'), e('ing'), p(' for you.')],
            translation: 'Она не будет тебя ждать.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Will'), C, S('S'), C, A('be'), C, V('V'), E('-ing'), Q],
        examples: [
          {
            parts: [a('Will '), s('you '), a('be '), v('work'), e('ing'), p(' at 5 pm?')],
            translation: 'Ты будешь работать в 5 вечера?',
          },
          {
            parts: [a('Will '), s('they '), a('be '), v('stay'), e('ing'), p(' at the hotel?')],
            translation: 'Они будут останавливаться в отеле?',
          },
        ],
      },
    ],
    signalWords: ['at this time tomorrow', 'at 5 o\'clock', 'all day', 'when'],
    usageTip: 'Описывает процесс в конкретный момент будущего, а не результат.',
  },
  {
    id: 'future_perfect',
    name: 'Future Perfect',
    group: 'future',
    shortDescription: 'Действие завершится к определённому моменту в будущем',
    forms: [
      {
        label: 'Утверждение',
        formula: [S('S'), C, A('will have'), C, V('V3')],
        examples: [
          {
            parts: [p('By Friday, '), s('I '), a('will have '), v('finished'), p(' the project.')],
            translation: 'К пятнице я закончу проект.',
            note: 'правильный: finish → finished',
          },
          {
            parts: [s('She '), a('will have '), v('written'), p(' the report by Monday.')],
            translation: 'Она напишет отчёт к понедельнику.',
            note: 'неправильный: write → written',
          },
        ],
      },
      {
        label: 'Отрицание',
        formula: [S('S'), C, A('will'), C, A('not'), C, A('have'), C, V('V3')],
        examples: [
          {
            parts: [s('I '), a("won't have "), v('finished'), p(' by then.')],
            translation: 'Я не закончу к тому времени.',
          },
          {
            parts: [s('They '), a("won't have "), v('left'), p(' by the time you arrive.')],
            translation: 'Они не уедут к твоему приезду.',
          },
        ],
      },
      {
        label: 'Вопрос',
        formula: [A('Will'), C, S('S'), C, A('have'), C, V('V3'), Q],
        examples: [
          {
            parts: [a('Will '), s('you '), a('have '), v('finished'), p(' by Friday?')],
            translation: 'Ты закончишь к пятнице?',
          },
          {
            parts: [a('Will '), s('she '), a('have '), v('read'), p(' the book by then?')],
            translation: 'Она прочитает книгу к тому времени?',
          },
        ],
      },
    ],
    signalWords: ['by', 'by the time', 'before', 'by next year', 'by then'],
    usageTip: 'Акцент на результате, который будет достигнут к определённому сроку.',
  },
];
