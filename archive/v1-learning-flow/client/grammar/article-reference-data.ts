export type ArticleGroup = 'indefinite' | 'definite' | 'zero' | 'expressions';

export type ArticlePartRole = 'article' | 'plain';

export type ArticlePart = {
  text: string;
  role: ArticlePartRole;
};

export type ArticleExample = {
  parts: ArticlePart[];
  translation: string;
  note?: string;
};

export type ArticleRuleItem = {
  id: string;
  title: string;
  group: ArticleGroup;
  shortDescription: string;
  explanation: string;
  examples: ArticleExample[];
  tip?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Article part (highlighted) */
const art = (text: string): ArticlePart => ({ text, role: 'article' });
/** Plain text part */
const p = (text: string): ArticlePart => ({ text, role: 'plain' });

// ─── Data ─────────────────────────────────────────────────────────────────────

export const ARTICLE_REFERENCE_DATA: ArticleRuleItem[] = [
  // ═══════════════════════════════ a / an (INDEFINITE) ═══════════════════════════
  {
    id: 'first_mention',
    title: 'Первое упоминание',
    group: 'indefinite',
    shortDescription: 'Когда говорим о чём-то впервые',
    explanation: 'Используем a/an, когда упоминаем предмет впервые — собеседник ещё не знает, о каком именно предмете речь.',
    examples: [
      { parts: [p('I saw '), art('a'), p(' dog in the park.')], translation: 'Я видел собаку в парке.' },
      { parts: [p('She bought '), art('a'), p(' new dress.')], translation: 'Она купила новое платье.' },
      { parts: [p('There is '), art('a'), p(' book on the table.')], translation: 'На столе лежит книга.' },
    ],
  },
  {
    id: 'profession',
    title: 'Профессия',
    group: 'indefinite',
    shortDescription: 'При указании профессии или рода занятий',
    explanation: 'Используем a/an, когда называем чью-то профессию или род занятий.',
    examples: [
      { parts: [p('He is '), art('a'), p(' teacher.')], translation: 'Он учитель.' },
      { parts: [p('She works as '), art('an'), p(' engineer.')], translation: 'Она работает инженером.' },
      { parts: [p('He wants to become '), art('a'), p(' pilot.')], translation: 'Он хочет стать пилотом.' },
    ],
  },
  {
    id: 'a_vs_an_vowel',
    title: 'a или an: правило звука',
    group: 'indefinite',
    shortDescription: 'an перед гласным звуком, a перед согласным',
    explanation: 'Выбор a или an зависит от звука, а не от буквы. Перед гласным звуком — an, перед согласным — a.',
    examples: [
      { parts: [art('an'), p(' apple')], translation: 'яблоко', note: '«a» — гласный звук → an' },
      { parts: [art('an'), p(' umbrella')], translation: 'зонт', note: '«u» — гласный звук → an' },
      { parts: [art('a'), p(' cat')], translation: 'кошка', note: '«c» — согласный звук → a' },
    ],
    tip: 'Важен именно звук, а не буква! Смотри следующее правило для хитрых случаев.',
  },
  {
    id: 'a_vs_an_tricky',
    title: 'Хитрые случаи a/an',
    group: 'indefinite',
    shortDescription: 'Немая h, звук «йу», аббревиатуры',
    explanation: 'Некоторые слова пишутся на гласную, но начинаются с согласного звука (и наоборот). Артикль подбираем по звуку.',
    examples: [
      { parts: [art('an'), p(' hour')], translation: 'час', note: 'Немая h → гласный звук «ау»' },
      { parts: [art('an'), p(' honest man')], translation: 'честный человек', note: 'Немая h → гласный звук' },
      { parts: [art('a'), p(' university')], translation: 'университет', note: 'Звук «йу» → согласный' },
      { parts: [art('a'), p(' unique idea')], translation: 'уникальная идея', note: 'Звук «йу» → согласный' },
      { parts: [art('an'), p(' FBI agent')], translation: 'агент ФБР', note: '«F» читается как «эф» → гласный' },
      { parts: [art('a'), p(' one-time offer')], translation: 'разовое предложение', note: '«One» читается как «уан» → согласный «w»' },
    ],
    tip: 'Запомни: university, uniform, unique, used — звук «йу» = согласный → a. Hour, honest, honor — немая h → an.',
  },
  {
    id: 'exclamation_what',
    title: 'Восклицания с What',
    group: 'indefinite',
    shortDescription: 'What a beautiful day!',
    explanation: 'В восклицаниях с What используем a/an перед исчисляемым существительным в единственном числе.',
    examples: [
      { parts: [p('What '), art('a'), p(' beautiful day!')], translation: 'Какой прекрасный день!' },
      { parts: [p('What '), art('an'), p(' interesting idea!')], translation: 'Какая интересная идея!' },
    ],
  },

  // ═══════════════════════════════ the (DEFINITE) ═══════════════════════════════
  {
    id: 'unique_objects',
    title: 'Уникальные объекты',
    group: 'definite',
    shortDescription: 'Солнце, луна, небо — то, что одно',
    explanation: 'Используем the с объектами, которые существуют в единственном экземпляре.',
    examples: [
      { parts: [art('The'), p(' sun is shining.')], translation: 'Солнце светит.' },
      { parts: [art('The'), p(' moon looks beautiful tonight.')], translation: 'Луна сегодня красива.' },
      { parts: [art('The'), p(' Earth goes around '), art('the'), p(' Sun.')], translation: 'Земля вращается вокруг Солнца.' },
    ],
  },
  {
    id: 'known_context',
    title: 'Известно из контекста',
    group: 'definite',
    shortDescription: 'Оба знают, о чём речь',
    explanation: 'Используем the, когда и говорящий, и слушающий понимают, о каком конкретном предмете идёт речь.',
    examples: [
      { parts: [p('Please close '), art('the'), p(' door.')], translation: 'Пожалуйста, закрой дверь.' },
      { parts: [p('Pass me '), art('the'), p(' salt.')], translation: 'Передай мне соль.', note: 'Соль на столе — оба видят' },
      { parts: [p('Where is '), art('the'), p(' bathroom?')], translation: 'Где ванная?' },
    ],
  },
  {
    id: 'second_mention',
    title: 'Повторное упоминание',
    group: 'definite',
    shortDescription: 'Первый раз a, второй — the',
    explanation: 'При первом упоминании используем a/an, при повторном — the (предмет уже известен).',
    examples: [
      { parts: [p('I saw a movie. '), art('The'), p(' movie was great.')], translation: 'Я посмотрел фильм. Фильм был отличный.' },
      { parts: [p('I met a girl. '), art('The'), p(' girl was very kind.')], translation: 'Я встретил девушку. Девушка была очень добрая.' },
    ],
    tip: 'Первый раз — a (новая информация). Второй раз — the (уже знаем, о чём речь).',
  },
  {
    id: 'superlative',
    title: 'Превосходная степень',
    group: 'definite',
    shortDescription: 'the best, the tallest, the most...',
    explanation: 'С превосходной степенью прилагательных всегда используем the — ведь «самый» может быть только один.',
    examples: [
      { parts: [p('She is '), art('the'), p(' best student.')], translation: 'Она лучшая ученица.' },
      { parts: [p('It was '), art('the'), p(' most exciting movie.')], translation: 'Это был самый захватывающий фильм.' },
      { parts: [p('Mount Everest is '), art('the'), p(' highest mountain.')], translation: 'Эверест — самая высокая гора.' },
    ],
  },
  {
    id: 'ordinal',
    title: 'Порядковые числительные',
    group: 'definite',
    shortDescription: 'the first, the second, the last...',
    explanation: 'С порядковыми числительными (first, second, third...) и словами last, next используем the.',
    examples: [
      { parts: [p('It was '), art('the'), p(' first time I traveled abroad.')], translation: 'Это был первый раз, когда я поехал за границу.' },
      { parts: [p('She lives on '), art('the'), p(' second floor.')], translation: 'Она живёт на втором этаже.' },
      { parts: [p('I missed '), art('the'), p(' last bus.')], translation: 'Я опоздал на последний автобус.' },
    ],
  },
  {
    id: 'geography',
    title: 'Географические названия',
    group: 'definite',
    shortDescription: 'Реки, океаны, горные хребты, некоторые страны',
    explanation: 'Используем the с реками, океанами, морями, горными хребтами, пустынями и странами с Republic/Kingdom/States в названии.',
    examples: [
      { parts: [art('the'), p(' Pacific Ocean')], translation: 'Тихий океан' },
      { parts: [art('the'), p(' Alps')], translation: 'Альпы', note: 'Горные хребты' },
      { parts: [art('the'), p(' Nile')], translation: 'Нил', note: 'Реки' },
      { parts: [art('the'), p(' United Kingdom')], translation: 'Великобритания', note: 'Kingdom в названии' },
    ],
    tip: 'Без the: большинство стран (Japan, Russia), города (Moscow, London), озёра (Lake Baikal), континенты.',
  },
  {
    id: 'the_adjective',
    title: 'The + прилагательное',
    group: 'definite',
    shortDescription: 'the rich, the poor — группы людей',
    explanation: 'the + прилагательное = группа людей с этим качеством.',
    examples: [
      { parts: [art('The'), p(' rich should help '), art('the'), p(' poor.')], translation: 'Богатые должны помогать бедным.' },
      { parts: [art('The'), p(' elderly need our support.')], translation: 'Пожилым нужна наша поддержка.' },
    ],
  },

  // ═══════════════════════════════ — (ZERO ARTICLE) ═══════════════════════════════
  {
    id: 'uncountable_general',
    title: 'Неисчисляемые в общем',
    group: 'zero',
    shortDescription: 'Music, water, love — без артикля',
    explanation: 'Неисчисляемые существительные в общем смысле (не конкретные) используются без артикля.',
    examples: [
      { parts: [p('Music is a powerful art.')], translation: 'Музыка — мощное искусство.' },
      { parts: [p('Water is essential for life.')], translation: 'Вода необходима для жизни.' },
      { parts: [p('Knowledge is power.')], translation: 'Знание — сила.' },
    ],
    tip: 'Но если неисчисляемое конкретное — используем the: «The water in this bottle is cold» (конкретная вода).',
  },
  {
    id: 'plural_general',
    title: 'Множественное число в общем',
    group: 'zero',
    shortDescription: 'Dogs are loyal — обо всех в целом',
    explanation: 'Существительные во множественном числе в обобщающих высказываниях используются без артикля.',
    examples: [
      { parts: [p('Dogs are loyal animals.')], translation: 'Собаки — верные животные.' },
      { parts: [p('Books are the best gifts.')], translation: 'Книги — лучшие подарки.' },
      { parts: [p('Teachers play an important role.')], translation: 'Учителя играют важную роль.' },
    ],
    tip: 'Но конкретная группа — с the: «The students in this class are smart» (конкретные студенты).',
  },
  {
    id: 'abstract',
    title: 'Абстрактные понятия',
    group: 'zero',
    shortDescription: 'Love, life, happiness — в общем смысле',
    explanation: 'Абстрактные существительные в общих высказываниях не требуют артикля.',
    examples: [
      { parts: [p('Love is a powerful feeling.')], translation: 'Любовь — мощное чувство.' },
      { parts: [p('Life is short.')], translation: 'Жизнь коротка.' },
      { parts: [p('Patience is a virtue.')], translation: 'Терпение — добродетель.' },
    ],
  },
  {
    id: 'languages_sports_subjects',
    title: 'Языки, спорт, предметы',
    group: 'zero',
    shortDescription: 'speak English, play football, study biology',
    explanation: 'Названия языков, видов спорта, игр и учебных дисциплин используются без артикля.',
    examples: [
      { parts: [p('She speaks English fluently.')], translation: 'Она свободно говорит по-английски.' },
      { parts: [p('We play football on Sundays.')], translation: 'Мы играем в футбол по воскресеньям.' },
      { parts: [p('She studies biology.')], translation: 'Она изучает биологию.' },
    ],
  },
  {
    id: 'meals_transport',
    title: 'Еда и транспорт',
    group: 'zero',
    shortDescription: 'have breakfast, go by bus',
    explanation: 'Названия приёмов пищи и средства транспорта после by используются без артикля.',
    examples: [
      { parts: [p('I had breakfast at 8 AM.')], translation: 'Я позавтракал в 8 утра.' },
      { parts: [p('We had dinner together.')], translation: 'Мы поужинали вместе.' },
      { parts: [p('He went home by bus.')], translation: 'Он поехал домой на автобусе.' },
    ],
  },
  {
    id: 'countries',
    title: 'Названия стран',
    group: 'zero',
    shortDescription: 'Japan, Russia — большинство без артикля',
    explanation: 'Большинство стран используются без артикля. Исключения: страны с Republic, Kingdom, States, а также множественные формы.',
    examples: [
      { parts: [p('They traveled to Japan.')], translation: 'Они путешествовали в Японию.' },
      { parts: [p('She lives in France.')], translation: 'Она живёт во Франции.' },
    ],
    tip: 'С the: the UK, the USA, the Netherlands, the Philippines (множественное число или Republic/Kingdom/States).',
  },

  // ═══════════════════════════════ EXPRESSIONS ═══════════════════════════════
  {
    id: 'expr_no_article',
    title: 'Без артикля',
    group: 'expressions',
    shortDescription: 'go to school, at home, at work, in bed',
    explanation: 'В некоторых устойчивых выражениях артикль не используется — предмет выступает в своей функции.',
    examples: [
      { parts: [p('go to school')], translation: 'ходить в школу', note: 'Учиться (не здание)' },
      { parts: [p('go to church')], translation: 'ходить в церковь', note: 'На службу' },
      { parts: [p('at home')], translation: 'дома' },
      { parts: [p('at work')], translation: 'на работе' },
      { parts: [p('in bed')], translation: 'в кровати' },
      { parts: [p('at noon / at night')], translation: 'в полдень / ночью' },
    ],
    tip: 'go to school (учиться) vs go to the school (зайти в здание школы) — смысл меняется!',
  },
  {
    id: 'expr_with_the',
    title: 'С артиклем the',
    group: 'expressions',
    shortDescription: 'in the morning, play the piano, go to the gym',
    explanation: 'В ряде устойчивых выражений используется артикль the.',
    examples: [
      { parts: [p('in '), art('the'), p(' morning / in '), art('the'), p(' evening')], translation: 'утром / вечером' },
      { parts: [p('play '), art('the'), p(' piano / '), art('the'), p(' guitar')], translation: 'играть на пианино / гитаре', note: 'Музыкальные инструменты' },
      { parts: [p('go to '), art('the'), p(' cinema / '), art('the'), p(' gym')], translation: 'ходить в кино / спортзал' },
      { parts: [p('go to '), art('the'), p(' bank / '), art('the'), p(' post office')], translation: 'ходить в банк / на почту' },
    ],
  },
  {
    id: 'expr_with_a',
    title: 'С артиклем a',
    group: 'expressions',
    shortDescription: 'go for a walk, have a good time',
    explanation: 'Некоторые устойчивые выражения требуют артикля a.',
    examples: [
      { parts: [p('go for '), art('a'), p(' walk')], translation: 'пойти на прогулку' },
      { parts: [p('have '), art('a'), p(' good time')], translation: 'хорошо провести время' },
      { parts: [p('take '), art('a'), p(' shower / '), art('a'), p(' bath')], translation: 'принять душ / ванну' },
      { parts: [p('have '), art('a'), p(' look')], translation: 'взглянуть' },
    ],
  },
];
