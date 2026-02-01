const partOfSpeechValues = ['noun', 'verb', 'adj', 'adv', 'phrase'] as const;
const difficultyValues = ['easy', 'medium', 'hard'] as const;

type PartOfSpeech = typeof partOfSpeechValues[number];
type Difficulty = typeof difficultyValues[number];

type Meaning = {
  translation: string;
  partOfSpeech: PartOfSpeech;
  contextExample: string;
  difficulty: Difficulty;
};

type SeedWord = {
  text: string;
  meanings: readonly Meaning[];
};

export const seedWords = [
  {
    text: 'train',
    meanings: [
      { translation: 'поезд', partOfSpeech: 'noun', contextExample: 'The train arrives at 5 pm.', difficulty: 'easy' },
      { translation: 'тренировать', partOfSpeech: 'verb', contextExample: 'I train every morning before work.', difficulty: 'medium' },
    ],
  },
  {
    text: 'book',
    meanings: [
      { translation: 'книга', partOfSpeech: 'noun', contextExample: 'She is reading a book.', difficulty: 'easy' },
      { translation: 'бронировать', partOfSpeech: 'verb', contextExample: 'I need to book a hotel room.', difficulty: 'medium' },
    ],
  },
  {
    text: 'light',
    meanings: [
      { translation: 'свет', partOfSpeech: 'noun', contextExample: 'Turn on the light, please.', difficulty: 'easy' },
      { translation: 'лёгкий', partOfSpeech: 'adj', contextExample: 'This bag is very light.', difficulty: 'easy' },
    ],
  },
  {
    text: 'run',
    meanings: [
      { translation: 'бежать', partOfSpeech: 'verb', contextExample: 'I run in the park every day.', difficulty: 'easy' },
      { translation: 'управлять', partOfSpeech: 'verb', contextExample: 'She runs a small business.', difficulty: 'medium' },
    ],
  },
  {
    text: 'play',
    meanings: [
      { translation: 'играть', partOfSpeech: 'verb', contextExample: 'The children play in the garden.', difficulty: 'easy' },
      { translation: 'пьеса', partOfSpeech: 'noun', contextExample: 'We saw a play at the theater.', difficulty: 'medium' },
    ],
  },
  {
    text: 'watch',
    meanings: [
      { translation: 'смотреть', partOfSpeech: 'verb', contextExample: 'I like to watch movies.', difficulty: 'easy' },
      { translation: 'часы (наручные)', partOfSpeech: 'noun', contextExample: 'He checked his watch.', difficulty: 'easy' },
    ],
  },
  {
    text: 'match',
    meanings: [
      { translation: 'матч', partOfSpeech: 'noun', contextExample: 'The football match starts at seven.', difficulty: 'easy' },
      { translation: 'совпадать', partOfSpeech: 'verb', contextExample: 'These colors do not match.', difficulty: 'medium' },
      { translation: 'спичка', partOfSpeech: 'noun', contextExample: 'He lit a match in the dark.', difficulty: 'easy' },
    ],
  },
  {
    text: 'right',
    meanings: [
      { translation: 'правый', partOfSpeech: 'adj', contextExample: 'Turn right at the corner.', difficulty: 'easy' },
      { translation: 'правильный', partOfSpeech: 'adj', contextExample: 'That is the right answer.', difficulty: 'easy' },
      { translation: 'право', partOfSpeech: 'noun', contextExample: 'Everyone has the right to education.', difficulty: 'medium' },
    ],
  },
  {
    text: 'bat',
    meanings: [
      { translation: 'летучая мышь', partOfSpeech: 'noun', contextExample: 'A bat flew out of the cave.', difficulty: 'medium' },
      { translation: 'бита', partOfSpeech: 'noun', contextExample: 'He swung the bat and hit the ball.', difficulty: 'medium' },
    ],
  },
  {
    text: 'bark',
    meanings: [
      { translation: 'лаять', partOfSpeech: 'verb', contextExample: 'The dog started to bark loudly.', difficulty: 'medium' },
      { translation: 'кора', partOfSpeech: 'noun', contextExample: 'The bark of this tree is very rough.', difficulty: 'medium' },
    ],
  },
  {
    text: 'fire',
    meanings: [
      { translation: 'огонь', partOfSpeech: 'noun', contextExample: 'We sat by the fire.', difficulty: 'easy' },
      { translation: 'увольнять', partOfSpeech: 'verb', contextExample: 'The company decided to fire him.', difficulty: 'medium' },
    ],
  },
  {
    text: 'spring',
    meanings: [
      { translation: 'весна', partOfSpeech: 'noun', contextExample: 'Flowers bloom in spring.', difficulty: 'easy' },
      { translation: 'пружина', partOfSpeech: 'noun', contextExample: 'The spring in the mattress broke.', difficulty: 'medium' },
      { translation: 'источник', partOfSpeech: 'noun', contextExample: 'We found a natural spring in the mountains.', difficulty: 'hard' },
    ],
  },
  {
    text: 'letter',
    meanings: [
      { translation: 'письмо', partOfSpeech: 'noun', contextExample: 'I received a letter from my friend.', difficulty: 'easy' },
      { translation: 'буква', partOfSpeech: 'noun', contextExample: 'The word has six letters.', difficulty: 'easy' },
    ],
  },
  {
    text: 'kind',
    meanings: [
      { translation: 'добрый', partOfSpeech: 'adj', contextExample: 'She is a very kind person.', difficulty: 'easy' },
      { translation: 'вид, тип', partOfSpeech: 'noun', contextExample: 'What kind of music do you like?', difficulty: 'easy' },
    ],
  },
  {
    text: 'cat',
    meanings: [
      { translation: 'кот', partOfSpeech: 'noun', contextExample: 'The cat is sleeping on the sofa.', difficulty: 'easy' },
    ],
  },
  {
    text: 'dog',
    meanings: [
      { translation: 'собака', partOfSpeech: 'noun', contextExample: 'My dog loves to play fetch.', difficulty: 'easy' },
    ],
  },
  {
    text: 'apple',
    meanings: [
      { translation: 'яблоко', partOfSpeech: 'noun', contextExample: 'She ate a red apple for lunch.', difficulty: 'easy' },
    ],
  },
  {
    text: 'water',
    meanings: [
      { translation: 'вода', partOfSpeech: 'noun', contextExample: 'Can I have a glass of water?', difficulty: 'easy' },
      { translation: 'поливать', partOfSpeech: 'verb', contextExample: 'Please water the flowers.', difficulty: 'medium' },
    ],
  },
  {
    text: 'house',
    meanings: [
      { translation: 'дом', partOfSpeech: 'noun', contextExample: 'They bought a new house.', difficulty: 'easy' },
    ],
  },
  {
    text: 'sun',
    meanings: [
      { translation: 'солнце', partOfSpeech: 'noun', contextExample: 'The sun is shining brightly today.', difficulty: 'easy' },
    ],
  },
  {
    text: 'table',
    meanings: [
      { translation: 'стол', partOfSpeech: 'noun', contextExample: 'Put the plate on the table.', difficulty: 'easy' },
    ],
  },
  {
    text: 'time',
    meanings: [
      { translation: 'время', partOfSpeech: 'noun', contextExample: 'What time is it?', difficulty: 'easy' },
    ],
  },
  {
    text: 'happy',
    meanings: [
      { translation: 'счастливый', partOfSpeech: 'adj', contextExample: 'She looks happy today.', difficulty: 'easy' },
    ],
  },
  {
    text: 'big',
    meanings: [
      { translation: 'большой', partOfSpeech: 'adj', contextExample: 'They live in a big city.', difficulty: 'easy' },
    ],
  },
  {
    text: 'friend',
    meanings: [
      { translation: 'друг', partOfSpeech: 'noun', contextExample: 'He is my best friend.', difficulty: 'easy' },
    ],
  },
  {
    text: 'food',
    meanings: [
      { translation: 'еда', partOfSpeech: 'noun', contextExample: 'The food in this restaurant is great.', difficulty: 'easy' },
    ],
  },
  {
    text: 'family',
    meanings: [
      { translation: 'семья', partOfSpeech: 'noun', contextExample: 'My family is very important to me.', difficulty: 'easy' },
    ],
  },
  {
    text: 'school',
    meanings: [
      { translation: 'школа', partOfSpeech: 'noun', contextExample: 'Children go to school every day.', difficulty: 'easy' },
    ],
  },
  {
    text: 'beautiful',
    meanings: [
      { translation: 'красивый', partOfSpeech: 'adj', contextExample: 'What a beautiful sunset!', difficulty: 'easy' },
    ],
  },
  {
    text: 'fast',
    meanings: [
      { translation: 'быстрый', partOfSpeech: 'adj', contextExample: 'He is a very fast runner.', difficulty: 'easy' },
      { translation: 'быстро', partOfSpeech: 'adv', contextExample: 'She speaks too fast.', difficulty: 'easy' },
    ],
  },
  {
    text: 'challenge',
    meanings: [
      { translation: 'вызов', partOfSpeech: 'noun', contextExample: 'Learning a new language is a real challenge.', difficulty: 'medium' },
      { translation: 'оспаривать', partOfSpeech: 'verb', contextExample: 'She decided to challenge the decision.', difficulty: 'hard' },
    ],
  },
  {
    text: 'develop',
    meanings: [
      { translation: 'развивать', partOfSpeech: 'verb', contextExample: 'We need to develop new skills.', difficulty: 'medium' },
    ],
  },
  {
    text: 'environment',
    meanings: [
      { translation: 'окружающая среда', partOfSpeech: 'noun', contextExample: 'We must protect the environment.', difficulty: 'medium' },
    ],
  },
  {
    text: 'experience',
    meanings: [
      { translation: 'опыт', partOfSpeech: 'noun', contextExample: 'She has ten years of experience.', difficulty: 'medium' },
      { translation: 'испытывать', partOfSpeech: 'verb', contextExample: 'You will experience something new.', difficulty: 'medium' },
    ],
  },
  {
    text: 'achieve',
    meanings: [
      { translation: 'достигать', partOfSpeech: 'verb', contextExample: 'She worked hard to achieve her goals.', difficulty: 'medium' },
    ],
  },
  {
    text: 'manage',
    meanings: [
      { translation: 'управлять', partOfSpeech: 'verb', contextExample: 'He manages a team of ten people.', difficulty: 'medium' },
      { translation: 'справляться', partOfSpeech: 'verb', contextExample: 'Can you manage on your own?', difficulty: 'medium' },
    ],
  },
  {
    text: 'support',
    meanings: [
      { translation: 'поддержка', partOfSpeech: 'noun', contextExample: 'Thank you for your support.', difficulty: 'medium' },
      { translation: 'поддерживать', partOfSpeech: 'verb', contextExample: 'I will always support you.', difficulty: 'medium' },
    ],
  },
  {
    text: 'research',
    meanings: [
      { translation: 'исследование', partOfSpeech: 'noun', contextExample: 'The research took three years.', difficulty: 'medium' },
      { translation: 'исследовать', partOfSpeech: 'verb', contextExample: 'Scientists research new methods.', difficulty: 'medium' },
    ],
  },
  {
    text: 'improve',
    meanings: [
      { translation: 'улучшать', partOfSpeech: 'verb', contextExample: 'I want to improve my English.', difficulty: 'medium' },
    ],
  },
  {
    text: 'increase',
    meanings: [
      { translation: 'увеличивать', partOfSpeech: 'verb', contextExample: 'They plan to increase production.', difficulty: 'medium' },
      { translation: 'рост', partOfSpeech: 'noun', contextExample: 'There was an increase in sales.', difficulty: 'medium' },
    ],
  },
  {
    text: 'provide',
    meanings: [
      { translation: 'предоставлять', partOfSpeech: 'verb', contextExample: 'We provide free delivery.', difficulty: 'medium' },
    ],
  },
  {
    text: 'require',
    meanings: [
      { translation: 'требовать', partOfSpeech: 'verb', contextExample: 'This job requires patience.', difficulty: 'medium' },
    ],
  },
  {
    text: 'consider',
    meanings: [
      { translation: 'рассматривать', partOfSpeech: 'verb', contextExample: 'Please consider my proposal.', difficulty: 'medium' },
    ],
  },
  {
    text: 'avoid',
    meanings: [
      { translation: 'избегать', partOfSpeech: 'verb', contextExample: 'Try to avoid making the same mistake.', difficulty: 'medium' },
    ],
  },
  {
    text: 'opportunity',
    meanings: [
      { translation: 'возможность', partOfSpeech: 'noun', contextExample: 'This is a great opportunity for growth.', difficulty: 'medium' },
    ],
  },
  {
    text: 'behavior',
    meanings: [
      { translation: 'поведение', partOfSpeech: 'noun', contextExample: 'His behavior was unacceptable.', difficulty: 'medium' },
    ],
  },
  {
    text: 'suggest',
    meanings: [
      { translation: 'предлагать', partOfSpeech: 'verb', contextExample: 'I suggest we leave early.', difficulty: 'medium' },
    ],
  },
  {
    text: 'particular',
    meanings: [
      { translation: 'определённый', partOfSpeech: 'adj', contextExample: 'Is there a particular reason you are late?', difficulty: 'medium' },
    ],
  },
  {
    text: 'current',
    meanings: [
      { translation: 'текущий', partOfSpeech: 'adj', contextExample: 'What is your current address?', difficulty: 'medium' },
      { translation: 'течение', partOfSpeech: 'noun', contextExample: 'The river has a strong current.', difficulty: 'hard' },
    ],
  },
  {
    text: 'involve',
    meanings: [
      { translation: 'включать, вовлекать', partOfSpeech: 'verb', contextExample: 'The project involves a lot of teamwork.', difficulty: 'medium' },
    ],
  },
  {
    text: 'remain',
    meanings: [
      { translation: 'оставаться', partOfSpeech: 'verb', contextExample: 'Please remain seated.', difficulty: 'medium' },
    ],
  },
  {
    text: 'approximately',
    meanings: [
      { translation: 'приблизительно', partOfSpeech: 'adv', contextExample: 'It takes approximately two hours.', difficulty: 'medium' },
    ],
  },
  {
    text: 'ambiguous',
    meanings: [
      { translation: 'двусмысленный', partOfSpeech: 'adj', contextExample: 'The instructions were ambiguous.', difficulty: 'hard' },
    ],
  },
  {
    text: 'elaborate',
    meanings: [
      { translation: 'подробный', partOfSpeech: 'adj', contextExample: 'She gave an elaborate explanation.', difficulty: 'hard' },
      { translation: 'уточнять', partOfSpeech: 'verb', contextExample: 'Could you elaborate on that point?', difficulty: 'hard' },
    ],
  },
  {
    text: 'negligible',
    meanings: [
      { translation: 'незначительный', partOfSpeech: 'adj', contextExample: 'The difference is negligible.', difficulty: 'hard' },
    ],
  },
  {
    text: 'comprehensive',
    meanings: [
      { translation: 'всеобъемлющий', partOfSpeech: 'adj', contextExample: 'We need a comprehensive analysis.', difficulty: 'hard' },
    ],
  },
  {
    text: 'acquire',
    meanings: [
      { translation: 'приобретать', partOfSpeech: 'verb', contextExample: 'She acquired new skills quickly.', difficulty: 'hard' },
    ],
  },
  {
    text: 'inevitable',
    meanings: [
      { translation: 'неизбежный', partOfSpeech: 'adj', contextExample: 'Change is inevitable.', difficulty: 'hard' },
    ],
  },
  {
    text: 'sufficient',
    meanings: [
      { translation: 'достаточный', partOfSpeech: 'adj', contextExample: 'Is this amount sufficient?', difficulty: 'hard' },
    ],
  },
  {
    text: 'consequently',
    meanings: [
      { translation: 'следовательно', partOfSpeech: 'adv', contextExample: 'He was late; consequently, he missed the meeting.', difficulty: 'hard' },
    ],
  },
  {
    text: 'distinguish',
    meanings: [
      { translation: 'различать', partOfSpeech: 'verb', contextExample: 'Can you distinguish between the two samples?', difficulty: 'hard' },
    ],
  },
  {
    text: 'reluctant',
    meanings: [
      { translation: 'неохотный', partOfSpeech: 'adj', contextExample: 'He was reluctant to admit his mistake.', difficulty: 'hard' },
    ],
  },
  {
    text: 'simultaneously',
    meanings: [
      { translation: 'одновременно', partOfSpeech: 'adv', contextExample: 'Both events happened simultaneously.', difficulty: 'hard' },
    ],
  },
  {
    text: 'persevere',
    meanings: [
      { translation: 'упорствовать', partOfSpeech: 'verb', contextExample: 'You must persevere despite difficulties.', difficulty: 'hard' },
    ],
  },
  {
    text: 'obsolete',
    meanings: [
      { translation: 'устаревший', partOfSpeech: 'adj', contextExample: 'This technology is now obsolete.', difficulty: 'hard' },
    ],
  },
  {
    text: 'versatile',
    meanings: [
      { translation: 'универсальный', partOfSpeech: 'adj', contextExample: 'She is a versatile musician.', difficulty: 'hard' },
    ],
  },
  {
    text: 'thoroughly',
    meanings: [
      { translation: 'тщательно', partOfSpeech: 'adv', contextExample: 'Please read the document thoroughly.', difficulty: 'hard' },
    ],
  },
  {
    text: 'undermine',
    meanings: [
      { translation: 'подрывать', partOfSpeech: 'verb', contextExample: 'Rumors can undermine trust.', difficulty: 'hard' },
    ],
  },
  {
    text: 'figure',
    meanings: [
      { translation: 'фигура', partOfSpeech: 'noun', contextExample: 'She has an athletic figure.', difficulty: 'medium' },
      { translation: 'цифра', partOfSpeech: 'noun', contextExample: 'Write the figure in the box.', difficulty: 'medium' },
      { translation: 'выяснять', partOfSpeech: 'verb', contextExample: 'I need to figure out the answer.', difficulty: 'hard' },
    ],
  },
  {
    text: 'draw',
    meanings: [
      { translation: 'рисовать', partOfSpeech: 'verb', contextExample: 'She likes to draw animals.', difficulty: 'easy' },
      { translation: 'ничья', partOfSpeech: 'noun', contextExample: 'The game ended in a draw.', difficulty: 'medium' },
    ],
  },
  {
    text: 'fair',
    meanings: [
      { translation: 'справедливый', partOfSpeech: 'adj', contextExample: 'That does not seem fair.', difficulty: 'medium' },
      { translation: 'ярмарка', partOfSpeech: 'noun', contextExample: 'We went to the county fair.', difficulty: 'medium' },
    ],
  },
  {
    text: 'degree',
    meanings: [
      { translation: 'степень', partOfSpeech: 'noun', contextExample: 'She has a degree in economics.', difficulty: 'medium' },
      { translation: 'градус', partOfSpeech: 'noun', contextExample: 'It is 30 degrees outside.', difficulty: 'easy' },
    ],
  },
  {
    text: 'point',
    meanings: [
      { translation: 'точка', partOfSpeech: 'noun', contextExample: 'Mark the point on the map.', difficulty: 'easy' },
      { translation: 'смысл', partOfSpeech: 'noun', contextExample: 'What is the point of this exercise?', difficulty: 'medium' },
      { translation: 'указывать', partOfSpeech: 'verb', contextExample: 'Do not point at people.', difficulty: 'easy' },
    ],
  },
  {
    text: 'subject',
    meanings: [
      { translation: 'предмет', partOfSpeech: 'noun', contextExample: 'Math is my favorite subject.', difficulty: 'medium' },
      { translation: 'подвергать', partOfSpeech: 'verb', contextExample: 'Do not subject yourself to unnecessary stress.', difficulty: 'hard' },
    ],
  },
  {
    text: 'novel',
    meanings: [
      { translation: 'роман', partOfSpeech: 'noun', contextExample: 'She is writing her first novel.', difficulty: 'medium' },
      { translation: 'новаторский', partOfSpeech: 'adj', contextExample: 'That is a novel approach to the problem.', difficulty: 'hard' },
    ],
  },
  {
    text: 'sentence',
    meanings: [
      { translation: 'предложение', partOfSpeech: 'noun', contextExample: 'Write a complete sentence.', difficulty: 'medium' },
      { translation: 'приговор', partOfSpeech: 'noun', contextExample: 'The judge announced the sentence.', difficulty: 'hard' },
    ],
  },
  {
    text: 'trip',
    meanings: [
      { translation: 'поездка', partOfSpeech: 'noun', contextExample: 'We planned a trip to the mountains.', difficulty: 'easy' },
      { translation: 'споткнуться', partOfSpeech: 'verb', contextExample: 'Be careful not to trip on the stairs.', difficulty: 'medium' },
    ],
  },
  {
    text: 'mean',
    meanings: [
      { translation: 'значить', partOfSpeech: 'verb', contextExample: 'What does this word mean?', difficulty: 'easy' },
      { translation: 'злой', partOfSpeech: 'adj', contextExample: 'Why are you being so mean?', difficulty: 'medium' },
    ],
  },
] as const satisfies readonly SeedWord[];

export type SeedWordsType = typeof seedWords;
