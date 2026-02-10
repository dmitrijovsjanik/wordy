export type ReadingQuestion = {
  question: string;
  questionRu: string;
  options: string[];
  correctIndex: number;
};

export type ReadingPassage = {
  id: string;
  level: 'A1' | 'A2' | 'B1';
  title: string;
  titleRu: string;
  topic: string;
  text: string;
  textRu: string;
  targetWords: string[];
  questions: ReadingQuestion[];
};

export const READING_PASSAGES: ReadingPassage[] = [
  // ═══════════════════════════════════════════════════════════════════
  // A1 LEVEL (10 texts)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'a1-01',
    level: 'A1',
    title: 'My Morning',
    titleRu: 'Моё утро',
    topic: 'daily routine',
    text: 'I wake up at seven o\'clock every day. I brush my teeth and wash my face. Then I eat breakfast. I usually have toast and tea. After breakfast, I put on my coat and go to work.',
    textRu: 'Я просыпаюсь в семь часов каждый день. Я чищу зубы и умываюсь. Потом я завтракаю. Обычно я ем тост и пью чай. После завтрака я надеваю пальто и иду на работу.',
    targetWords: ['wake up', 'brush', 'breakfast', 'usually', 'coat'],
    questions: [
      {
        question: 'What time does the person wake up?',
        questionRu: 'Во сколько просыпается этот человек?',
        options: ['At six o\'clock', 'At seven o\'clock', 'At eight o\'clock', 'At nine o\'clock'],
        correctIndex: 1,
      },
      {
        question: 'What does the person usually have for breakfast?',
        questionRu: 'Что этот человек обычно ест на завтрак?',
        options: ['Eggs and juice', 'Cereal and milk', 'Toast and tea', 'Coffee and a sandwich'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a1-02',
    level: 'A1',
    title: 'At the Shop',
    titleRu: 'В магазине',
    topic: 'shopping',
    text: 'Anna goes to the shop after school. She wants to buy some fruit. She takes two apples and a banana. "How much is it?" she asks. "One dollar fifty," says the man. Anna pays and goes home.',
    textRu: 'Анна идёт в магазин после школы. Она хочет купить фрукты. Она берёт два яблока и банан. «Сколько это стоит?» — спрашивает она. «Доллар пятьдесят», — говорит мужчина. Анна платит и идёт домой.',
    targetWords: ['shop', 'buy', 'fruit', 'how much', 'pays'],
    questions: [
      {
        question: 'When does Anna go to the shop?',
        questionRu: 'Когда Анна идёт в магазин?',
        options: ['Before school', 'After school', 'In the morning', 'At night'],
        correctIndex: 1,
      },
      {
        question: 'How much does Anna pay?',
        questionRu: 'Сколько платит Анна?',
        options: ['One dollar', 'One dollar fifty', 'Two dollars', 'Fifty cents'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'a1-03',
    level: 'A1',
    title: 'My Family',
    titleRu: 'Моя семья',
    topic: 'family',
    text: 'My family is not big. There are four people: my mother, my father, my sister, and me. My mother is a teacher. My father works in a hospital. My sister is five years old. She is very funny. We live in a small house near the river.',
    textRu: 'Моя семья небольшая. Нас четверо: мама, папа, сестра и я. Моя мама — учительница. Мой папа работает в больнице. Моей сестре пять лет. Она очень смешная. Мы живём в маленьком доме у реки.',
    targetWords: ['family', 'teacher', 'hospital', 'funny', 'near'],
    questions: [
      {
        question: 'How many people are in the family?',
        questionRu: 'Сколько человек в семье?',
        options: ['Three', 'Four', 'Five', 'Six'],
        correctIndex: 1,
      },
      {
        question: 'Where does the father work?',
        questionRu: 'Где работает отец?',
        options: ['In a school', 'In a shop', 'In a hospital', 'In an office'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a1-04',
    level: 'A1',
    title: 'The Weather Today',
    titleRu: 'Погода сегодня',
    topic: 'weather',
    text: 'Today the weather is bad. It is cold and rainy. I do not want to go outside. I stay at home and read a book. My cat sits next to me on the sofa. I drink hot chocolate. I like rainy days at home.',
    textRu: 'Сегодня плохая погода. Холодно и дождливо. Я не хочу выходить на улицу. Я остаюсь дома и читаю книгу. Мой кот сидит рядом со мной на диване. Я пью горячий шоколад. Мне нравятся дождливые дни дома.',
    targetWords: ['weather', 'cold', 'rainy', 'outside', 'sofa'],
    questions: [
      {
        question: 'Why does the person stay at home?',
        questionRu: 'Почему этот человек остаётся дома?',
        options: ['Because they are sick', 'Because the weather is bad', 'Because they have no friends', 'Because the shop is closed'],
        correctIndex: 1,
      },
      {
        question: 'What is the person doing at home?',
        questionRu: 'Чем этот человек занимается дома?',
        options: ['Watching TV', 'Cooking dinner', 'Reading a book', 'Playing games'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a1-05',
    level: 'A1',
    title: 'Lunch Time',
    titleRu: 'Время обеда',
    topic: 'food',
    text: 'It is twelve o\'clock. Time for lunch! I go to the kitchen. I make a sandwich with cheese and tomato. I also eat a bowl of soup. The soup is very hot. I wait a little. Then I eat it. It is delicious.',
    textRu: 'Двенадцать часов. Время обедать! Я иду на кухню. Я делаю бутерброд с сыром и помидором. Ещё я ем тарелку супа. Суп очень горячий. Я немного жду. Потом ем. Он очень вкусный.',
    targetWords: ['kitchen', 'sandwich', 'cheese', 'soup', 'delicious'],
    questions: [
      {
        question: 'What time is lunch?',
        questionRu: 'Во сколько обед?',
        options: ['Eleven o\'clock', 'Twelve o\'clock', 'One o\'clock', 'Two o\'clock'],
        correctIndex: 1,
      },
      {
        question: 'Why does the person wait before eating the soup?',
        questionRu: 'Почему человек ждёт, прежде чем есть суп?',
        options: ['The soup is cold', 'The soup is very hot', 'There is no spoon', 'The soup looks bad'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'a1-06',
    level: 'A1',
    title: 'My Room',
    titleRu: 'Моя комната',
    topic: 'home',
    text: 'My room is small but nice. There is a bed, a desk, and a chair. I have a lamp on the desk. The walls are blue. I keep my books on a shelf. There is a window next to my bed. I can see trees from my window.',
    textRu: 'Моя комната маленькая, но уютная. В ней есть кровать, стол и стул. На столе стоит лампа. Стены голубые. Я храню книги на полке. Рядом с кроватью — окно. Из окна видны деревья.',
    targetWords: ['desk', 'lamp', 'walls', 'shelf', 'window'],
    questions: [
      {
        question: 'What colour are the walls?',
        questionRu: 'Какого цвета стены?',
        options: ['White', 'Green', 'Blue', 'Yellow'],
        correctIndex: 2,
      },
      {
        question: 'What can the person see from the window?',
        questionRu: 'Что видно из окна?',
        options: ['A river', 'Other houses', 'Trees', 'A park'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a1-07',
    level: 'A1',
    title: 'A New Friend',
    titleRu: 'Новый друг',
    topic: 'school/meeting',
    text: 'Today there is a new boy in our class. His name is Tom. He is from Canada. He speaks English and a little French. At break time, I say hello to him. We talk about football. Tom likes the same team as me. I think we will be good friends.',
    textRu: 'Сегодня в нашем классе новый мальчик. Его зовут Том. Он из Канады. Он говорит по-английски и немного по-французски. На перемене я здороваюсь с ним. Мы разговариваем о футболе. Тому нравится та же команда, что и мне. Думаю, мы станем хорошими друзьями.',
    targetWords: ['class', 'speaks', 'break', 'team', 'friends'],
    questions: [
      {
        question: 'Where is Tom from?',
        questionRu: 'Откуда Том?',
        options: ['England', 'Canada', 'France', 'America'],
        correctIndex: 1,
      },
      {
        question: 'What do the two boys talk about?',
        questionRu: 'О чём разговаривают мальчики?',
        options: ['School', 'Music', 'Football', 'Food'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a1-08',
    level: 'A1',
    title: 'The Park',
    titleRu: 'Парк',
    topic: 'hobbies/nature',
    text: 'On Saturday I go to the park with my dog, Max. The park is big and green. Max runs and plays with other dogs. I sit on a bench and listen to music. There are many flowers in the park. It is a beautiful day. We stay for two hours.',
    textRu: 'В субботу я иду в парк с моей собакой Максом. Парк большой и зелёный. Макс бегает и играет с другими собаками. Я сижу на скамейке и слушаю музыку. В парке много цветов. Прекрасный день. Мы остаёмся на два часа.',
    targetWords: ['park', 'bench', 'listen', 'flowers', 'beautiful'],
    questions: [
      {
        question: 'What does the person do in the park?',
        questionRu: 'Чем занимается этот человек в парке?',
        options: ['Runs with the dog', 'Sits on a bench and listens to music', 'Reads a book', 'Plays football'],
        correctIndex: 1,
      },
      {
        question: 'How long do they stay in the park?',
        questionRu: 'Сколько они остаются в парке?',
        options: ['One hour', 'Two hours', 'Three hours', 'All day'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'a1-09',
    level: 'A1',
    title: 'The Bus',
    titleRu: 'Автобус',
    topic: 'transport',
    text: 'Every morning I take the bus to work. The bus stop is near my house. I wait five minutes. The bus comes at eight fifteen. It is always full of people. I stand because there are no free seats. The ride takes twenty minutes. I get off at the last stop.',
    textRu: 'Каждое утро я еду на автобусе на работу. Остановка рядом с моим домом. Я жду пять минут. Автобус приходит в восемь пятнадцать. Он всегда полон людей. Я стою, потому что свободных мест нет. Дорога занимает двадцать минут. Я выхожу на последней остановке.',
    targetWords: ['bus stop', 'wait', 'full', 'seats', 'ride'],
    questions: [
      {
        question: 'Why does the person stand on the bus?',
        questionRu: 'Почему этот человек стоит в автобусе?',
        options: ['They like to stand', 'The seats are dirty', 'There are no free seats', 'The ride is very short'],
        correctIndex: 2,
      },
      {
        question: 'How long is the bus ride?',
        questionRu: 'Сколько длится поездка на автобусе?',
        options: ['Five minutes', 'Ten minutes', 'Fifteen minutes', 'Twenty minutes'],
        correctIndex: 3,
      },
    ],
  },

  {
    id: 'a1-10',
    level: 'A1',
    title: 'My Pet',
    titleRu: 'Мой питомец',
    topic: 'animals',
    text: 'I have a small white cat. Her name is Luna. She sleeps a lot during the day. At night she likes to play. Her favourite toy is a little ball. She eats fish and special cat food. Luna is three years old. She is very sweet and quiet.',
    textRu: 'У меня есть маленькая белая кошка. Её зовут Луна. Она много спит днём. Ночью она любит играть. Её любимая игрушка — маленький мячик. Она ест рыбу и специальный кошачий корм. Луне три года. Она очень милая и тихая.',
    targetWords: ['sleeps', 'favourite', 'toy', 'special', 'quiet'],
    questions: [
      {
        question: 'When does Luna like to play?',
        questionRu: 'Когда Луна любит играть?',
        options: ['In the morning', 'In the afternoon', 'At night', 'All day'],
        correctIndex: 2,
      },
      {
        question: 'What is Luna\'s favourite toy?',
        questionRu: 'Какая любимая игрушка Луны?',
        options: ['A mouse', 'A ball', 'A string', 'A box'],
        correctIndex: 1,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // A2 LEVEL (10 texts)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'a2-01',
    level: 'A2',
    title: 'A Trip to London',
    titleRu: 'Поездка в Лондон',
    topic: 'travel',
    text: 'Last summer, my friend and I visited London for the first time. We took the train from Paris, which was very fast and comfortable. In London, we saw Big Ben, Tower Bridge, and Buckingham Palace. The city was bigger than I expected. We tried fish and chips at a small restaurant near the Thames. It was the best trip I have ever had.',
    textRu: 'Прошлым летом мы с другом впервые побывали в Лондоне. Мы доехали на поезде из Парижа — было очень быстро и удобно. В Лондоне мы увидели Биг-Бен, Тауэрский мост и Букингемский дворец. Город оказался больше, чем я ожидал. Мы попробовали фиш-энд-чипс в маленьком ресторане у Темзы. Это была лучшая поездка в моей жизни.',
    targetWords: ['visited', 'comfortable', 'expected', 'restaurant', 'trip'],
    questions: [
      {
        question: 'How did they travel to London?',
        questionRu: 'Как они добрались до Лондона?',
        options: ['By plane', 'By car', 'By train', 'By bus'],
        correctIndex: 2,
      },
      {
        question: 'What surprised the person about London?',
        questionRu: 'Что удивило этого человека в Лондоне?',
        options: ['It was very expensive', 'It was bigger than expected', 'It was very cold', 'There were too many tourists'],
        correctIndex: 1,
      },
      {
        question: 'Where did they eat fish and chips?',
        questionRu: 'Где они ели фиш-энд-чипс?',
        options: ['At a hotel', 'At a market', 'Near Buckingham Palace', 'Near the Thames'],
        correctIndex: 3,
      },
    ],
  },

  {
    id: 'a2-02',
    level: 'A2',
    title: 'The New Job',
    titleRu: 'Новая работа',
    topic: 'work',
    text: 'Maria started a new job last Monday. She works as a receptionist at a hotel in the city centre. She answers phone calls and helps guests with their questions. Her colleagues are friendly and helpful. The hours are long — she works from eight in the morning until six in the evening. She is tired at the end of the day, but she enjoys meeting different people.',
    textRu: 'Мария начала новую работу в прошлый понедельник. Она работает администратором в отеле в центре города. Она отвечает на звонки и помогает гостям с вопросами. Коллеги у неё дружелюбные и отзывчивые. Рабочий день длинный — с восьми утра до шести вечера. К концу дня она устаёт, но ей нравится знакомиться с разными людьми.',
    targetWords: ['receptionist', 'guests', 'colleagues', 'helpful', 'enjoys'],
    questions: [
      {
        question: 'Where does Maria work?',
        questionRu: 'Где работает Мария?',
        options: ['At a hospital', 'At a school', 'At a hotel', 'At a bank'],
        correctIndex: 2,
      },
      {
        question: 'What does Maria like about her job?',
        questionRu: 'Что Марии нравится в её работе?',
        options: ['The short hours', 'Meeting different people', 'The high salary', 'Working from home'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'a2-03',
    level: 'A2',
    title: 'At the Doctor',
    titleRu: 'У врача',
    topic: 'health',
    text: 'I woke up this morning with a terrible headache and a sore throat. I decided to go to the doctor. In the waiting room, there were many other patients. After thirty minutes, the doctor called my name. She checked my temperature and looked at my throat. She said I had a cold and needed to rest for a few days. She also gave me a prescription for some medicine.',
    textRu: 'Сегодня утром я проснулся с ужасной головной болью и больным горлом. Я решил пойти к врачу. В приёмной было много других пациентов. Через тридцать минут врач вызвала меня. Она измерила мне температуру и осмотрела горло. Она сказала, что у меня простуда и нужно отдыхать несколько дней. Ещё она выписала рецепт на лекарство.',
    targetWords: ['headache', 'sore throat', 'patients', 'temperature', 'prescription'],
    questions: [
      {
        question: 'What was wrong with the person?',
        questionRu: 'Что случилось с этим человеком?',
        options: ['They broke their arm', 'They had a stomach ache', 'They had a headache and sore throat', 'They hurt their leg'],
        correctIndex: 2,
      },
      {
        question: 'What did the doctor tell the person to do?',
        questionRu: 'Что врач посоветовала этому человеку?',
        options: ['Go to hospital', 'Rest for a few days', 'Take a holiday', 'Drink more water'],
        correctIndex: 1,
      },
      {
        question: 'How long did the person wait to see the doctor?',
        questionRu: 'Сколько человек ждал приёма у врача?',
        options: ['Ten minutes', 'Twenty minutes', 'Thirty minutes', 'One hour'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a2-04',
    level: 'A2',
    title: 'City Life',
    titleRu: 'Городская жизнь',
    topic: 'city',
    text: 'Living in a big city has advantages and disadvantages. There are many shops, cinemas, and restaurants, so you never get bored. Public transport is usually good, and you can get around easily. However, the streets are noisy and crowded. Apartments are expensive, and the air is not very clean. Some people prefer the quiet countryside, but I love the energy of the city.',
    textRu: 'Жизнь в большом городе имеет свои плюсы и минусы. Здесь много магазинов, кинотеатров и ресторанов, так что скучать не приходится. Общественный транспорт обычно хороший, и передвигаться легко. Но на улицах шумно и многолюдно. Квартиры дорогие, а воздух не очень чистый. Кто-то предпочитает тихую деревню, но мне нравится энергия города.',
    targetWords: ['advantages', 'crowded', 'expensive', 'prefer', 'energy'],
    questions: [
      {
        question: 'What is one disadvantage of city life mentioned in the text?',
        questionRu: 'Какой недостаток городской жизни упоминается в тексте?',
        options: ['There are no shops', 'The transport is bad', 'Apartments are expensive', 'There are no parks'],
        correctIndex: 2,
      },
      {
        question: 'How does the author feel about living in a city?',
        questionRu: 'Как автор относится к жизни в городе?',
        options: ['They hate it', 'They love it', 'They want to move', 'They are not sure'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'a2-05',
    level: 'A2',
    title: 'The Birthday Party',
    titleRu: 'День рождения',
    topic: 'social',
    text: 'Last Saturday was my friend Katya\'s birthday. She invited twelve people to her flat for a party. I brought her a present — a book she wanted to read. There was a big chocolate cake with candles on the table. We played music, danced, and talked until midnight. Some friends prepared a surprise video with old photos. Katya cried a little because she was so happy. It was a wonderful evening.',
    textRu: 'В прошлую субботу был день рождения моей подруги Кати. Она пригласила двенадцать человек к себе домой. Я принёс ей подарок — книгу, которую она хотела прочитать. На столе стоял большой шоколадный торт со свечами. Мы слушали музыку, танцевали и разговаривали до полуночи. Некоторые друзья подготовили видео-сюрприз со старыми фотографиями. Катя немного всплакнула от счастья. Это был чудесный вечер.',
    targetWords: ['invited', 'present', 'candles', 'surprise', 'wonderful'],
    questions: [
      {
        question: 'What present did the person bring?',
        questionRu: 'Какой подарок принёс этот человек?',
        options: ['Flowers', 'A book', 'Chocolate', 'A toy'],
        correctIndex: 1,
      },
      {
        question: 'Why did Katya cry?',
        questionRu: 'Почему Катя заплакала?',
        options: ['She was sad', 'She didn\'t like the cake', 'She was very happy', 'She was tired'],
        correctIndex: 2,
      },
      {
        question: 'How many people were invited to the party?',
        questionRu: 'Сколько человек пригласили на вечеринку?',
        options: ['Eight', 'Ten', 'Twelve', 'Fifteen'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a2-06',
    level: 'A2',
    title: 'Cooking Dinner',
    titleRu: 'Готовим ужин',
    topic: 'cooking',
    text: 'Tonight I am going to cook dinner for my family. I am making pasta with tomato sauce and vegetables. First, I need to chop the onions, garlic, and peppers. Then I fry them in a pan with olive oil. I add the tomatoes and let everything cook for twenty minutes. While the sauce is cooking, I boil the pasta. My mother says it smells amazing. I hope everyone likes it.',
    textRu: 'Сегодня вечером я собираюсь приготовить ужин для семьи. Я готовлю пасту с томатным соусом и овощами. Сначала мне нужно нарезать лук, чеснок и перец. Потом я обжариваю их на сковороде с оливковым маслом. Добавляю помидоры и оставляю всё готовиться двадцать минут. Пока соус готовится, я варю пасту. Мама говорит, что пахнет потрясающе. Надеюсь, всем понравится.',
    targetWords: ['chop', 'garlic', 'fry', 'olive oil', 'boil'],
    questions: [
      {
        question: 'What is the person cooking?',
        questionRu: 'Что готовит этот человек?',
        options: ['Rice with chicken', 'Pasta with tomato sauce', 'Soup with vegetables', 'A salad'],
        correctIndex: 1,
      },
      {
        question: 'How long does the sauce need to cook?',
        questionRu: 'Сколько нужно готовить соус?',
        options: ['Ten minutes', 'Fifteen minutes', 'Twenty minutes', 'Thirty minutes'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a2-07',
    level: 'A2',
    title: 'Summer Holiday',
    titleRu: 'Летние каникулы',
    topic: 'holidays',
    text: 'Every summer, our family goes to the seaside for two weeks. We usually stay in a small hotel near the beach. My parents like to lie in the sun and read, but I prefer swimming and playing volleyball. Last year, I tried surfing for the first time. I fell off the board many times, but it was so much fun. In the evenings, we walk along the coast and eat ice cream. I am already looking forward to next summer.',
    textRu: 'Каждое лето наша семья ездит на море на две недели. Обычно мы останавливаемся в маленьком отеле у пляжа. Родители любят загорать и читать, а я предпочитаю плавать и играть в волейбол. В прошлом году я впервые попробовал сёрфинг. Я много раз падал с доски, но было очень весело. По вечерам мы гуляем вдоль побережья и едим мороженое. Я уже жду следующего лета.',
    targetWords: ['seaside', 'beach', 'surfing', 'coast', 'looking forward'],
    questions: [
      {
        question: 'How long does the family stay at the seaside?',
        questionRu: 'Сколько семья проводит на море?',
        options: ['One week', 'Two weeks', 'Three weeks', 'One month'],
        correctIndex: 1,
      },
      {
        question: 'What happened when the person tried surfing?',
        questionRu: 'Что произошло, когда этот человек попробовал сёрфинг?',
        options: ['They were great at it', 'They didn\'t like it', 'They fell off many times', 'They got hurt'],
        correctIndex: 2,
      },
      {
        question: 'What do they do in the evenings?',
        questionRu: 'Что они делают по вечерам?',
        options: ['Watch TV in the hotel', 'Walk along the coast and eat ice cream', 'Go to restaurants', 'Play board games'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'a2-08',
    level: 'A2',
    title: 'The Football Match',
    titleRu: 'Футбольный матч',
    topic: 'sports',
    text: 'Yesterday I watched a football match at the stadium with my brother. Our team was losing two to zero at half-time, and we were very disappointed. But in the second half, everything changed. Our team scored three goals in thirty minutes! The crowd was screaming and cheering. The final score was three to two. It was an incredible comeback. We celebrated all the way home.',
    textRu: 'Вчера я смотрел футбольный матч на стадионе с братом. В перерыве наша команда проигрывала два-ноль, и мы были очень расстроены. Но во втором тайме всё изменилось. Наша команда забила три гола за тридцать минут! Толпа кричала и ликовала. Финальный счёт — три-два. Это был невероятный камбэк. Мы праздновали всю дорогу домой.',
    targetWords: ['stadium', 'disappointed', 'scored', 'crowd', 'incredible'],
    questions: [
      {
        question: 'What was the score at half-time?',
        questionRu: 'Какой был счёт в перерыве?',
        options: ['One to zero', 'Two to zero', 'Two to one', 'Three to zero'],
        correctIndex: 1,
      },
      {
        question: 'How did the match end?',
        questionRu: 'Чем закончился матч?',
        options: ['The team lost', 'It was a draw', 'The team won three to two', 'The match was cancelled'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a2-09',
    level: 'A2',
    title: 'Moving House',
    titleRu: 'Переезд',
    topic: 'living',
    text: 'We are moving to a new apartment next week. It is in a different neighbourhood, closer to my school. The new apartment is larger than our old one — it has three bedrooms and a balcony. I am excited about having my own room at last. My parents are busy packing boxes every evening. Moving is hard work, but I think we will be happier in the new place. I cannot wait to decorate my room.',
    textRu: 'На следующей неделе мы переезжаем в новую квартиру. Она в другом районе, ближе к моей школе. Новая квартира больше старой — в ней три спальни и балкон. Я рад, что наконец у меня будет своя комната. Родители каждый вечер заняты упаковкой коробок. Переезд — тяжёлая работа, но я думаю, в новом месте нам будет лучше. Не могу дождаться, когда буду обустраивать свою комнату.',
    targetWords: ['neighbourhood', 'balcony', 'packing', 'decorate', 'excited'],
    questions: [
      {
        question: 'Why is the person excited about moving?',
        questionRu: 'Почему этот человек рад переезду?',
        options: ['The apartment is cheaper', 'They will have their own room', 'They will live with friends', 'The apartment has a garden'],
        correctIndex: 1,
      },
      {
        question: 'How is the new apartment compared to the old one?',
        questionRu: 'Какая новая квартира по сравнению со старой?',
        options: ['Smaller', 'The same size', 'Larger', 'More expensive'],
        correctIndex: 2,
      },
      {
        question: 'Where is the new apartment located?',
        questionRu: 'Где находится новая квартира?',
        options: ['Far from school', 'In the countryside', 'Closer to school', 'In the city centre'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'a2-10',
    level: 'A2',
    title: 'The Library',
    titleRu: 'Библиотека',
    topic: 'education',
    text: 'I go to the city library every Wednesday afternoon. It is a quiet, peaceful place where I can concentrate on my studies. There are thousands of books on every topic you can imagine. I usually sit in the reading room near the big window. Last week, I borrowed a book about the history of space travel. The librarian recommended it to me. I finished it in three days because it was so interesting.',
    textRu: 'Каждую среду после обеда я хожу в городскую библиотеку. Это тихое, спокойное место, где я могу сосредоточиться на учёбе. Там тысячи книг на любую тему, какую можно представить. Обычно я сажусь в читальном зале у большого окна. На прошлой неделе я взял книгу об истории космических путешествий. Библиотекарь мне её порекомендовала. Я прочитал её за три дня, потому что она была очень интересной.',
    targetWords: ['library', 'peaceful', 'concentrate', 'borrowed', 'recommended'],
    questions: [
      {
        question: 'How often does the person go to the library?',
        questionRu: 'Как часто этот человек ходит в библиотеку?',
        options: ['Every day', 'Every Monday', 'Every Wednesday', 'Every weekend'],
        correctIndex: 2,
      },
      {
        question: 'What was the book about?',
        questionRu: 'О чём была книга?',
        options: ['History of art', 'History of space travel', 'History of music', 'History of computers'],
        correctIndex: 1,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // B1 LEVEL (10 texts)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: 'b1-01',
    level: 'B1',
    title: 'Social Media',
    titleRu: 'Социальные сети',
    topic: 'technology',
    text: 'Social media has become an essential part of modern life, but its effects on mental health are becoming a growing concern. Studies have shown that people who spend more than three hours a day on social platforms tend to experience higher levels of anxiety and loneliness. The constant comparison with others\' carefully curated lives can damage self-esteem, especially among teenagers. On the other hand, social media has also helped people stay connected with friends and family across the world. Many communities have formed online around shared interests and support. The key, according to psychologists, is to use these platforms mindfully and set clear boundaries for screen time.',
    textRu: 'Социальные сети стали неотъемлемой частью современной жизни, но их влияние на психическое здоровье вызывает всё больше беспокойства. Исследования показали, что люди, проводящие в соцсетях больше трёх часов в день, чаще испытывают тревожность и одиночество. Постоянное сравнение себя с тщательно отобранными картинками чужой жизни может подорвать самооценку, особенно у подростков. С другой стороны, социальные сети помогают поддерживать связь с друзьями и семьёй по всему миру. В интернете сформировались целые сообщества, объединённые общими интересами и взаимной поддержкой. По мнению психологов, главное — пользоваться этими платформами осознанно и устанавливать чёткие границы экранного времени.',
    targetWords: ['essential', 'anxiety', 'comparison', 'self-esteem', 'boundaries'],
    questions: [
      {
        question: 'According to the text, what can damage self-esteem?',
        questionRu: 'Согласно тексту, что может подорвать самооценку?',
        options: ['Spending time with friends', 'Constant comparison with others', 'Reading news online', 'Playing video games'],
        correctIndex: 1,
      },
      {
        question: 'What do psychologists recommend?',
        questionRu: 'Что рекомендуют психологи?',
        options: ['Stop using social media completely', 'Use platforms mindfully with clear boundaries', 'Only use social media for work', 'Spend at least three hours a day online'],
        correctIndex: 1,
      },
      {
        question: 'What is one positive effect of social media mentioned in the text?',
        questionRu: 'Какой положительный эффект соцсетей упоминается в тексте?',
        options: ['It makes people more productive', 'It helps people earn money', 'It helps people stay connected across the world', 'It improves physical health'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'b1-02',
    level: 'B1',
    title: 'Climate Change',
    titleRu: 'Изменение климата',
    topic: 'environment',
    text: 'Climate change is one of the most serious challenges facing humanity today. Average global temperatures have risen by over one degree Celsius since the industrial revolution, and the consequences are already visible. Glaciers are melting, sea levels are rising, and extreme weather events such as floods, droughts, and wildfires have become more frequent. Scientists agree that human activity, particularly the burning of fossil fuels, is the main cause. Governments around the world have pledged to reduce carbon emissions, but many experts believe that current efforts are not enough. Individual actions, such as reducing energy consumption, eating less meat, and choosing public transport, can also make a difference.',
    textRu: 'Изменение климата — одна из самых серьёзных проблем, стоящих перед человечеством. Средняя температура на планете выросла более чем на один градус Цельсия с начала промышленной революции, и последствия уже заметны. Ледники тают, уровень моря повышается, а экстремальные погодные явления — наводнения, засухи и лесные пожары — участились. Учёные сходятся во мнении, что основная причина — деятельность человека, прежде всего сжигание ископаемого топлива. Правительства по всему миру обязались сократить выбросы углекислого газа, но многие эксперты считают, что текущих мер недостаточно. Индивидуальные действия — снижение потребления энергии, сокращение мяса в рационе, использование общественного транспорта — тоже могут помочь.',
    targetWords: ['challenges', 'consequences', 'frequent', 'emissions', 'consumption'],
    questions: [
      {
        question: 'What is the main cause of climate change according to scientists?',
        questionRu: 'Что, по мнению учёных, является основной причиной изменения климата?',
        options: ['Natural cycles', 'Human activity', 'Solar radiation', 'Volcanic eruptions'],
        correctIndex: 1,
      },
      {
        question: 'How much have average global temperatures risen since the industrial revolution?',
        questionRu: 'На сколько выросла средняя температура на планете с начала промышленной революции?',
        options: ['Half a degree', 'Over one degree', 'Two degrees', 'Three degrees'],
        correctIndex: 1,
      },
      {
        question: 'What do many experts think about current government efforts?',
        questionRu: 'Что многие эксперты думают о текущих мерах правительств?',
        options: ['They are very effective', 'They are not enough', 'They are unnecessary', 'They are too expensive'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'b1-03',
    level: 'B1',
    title: 'A Cultural Shock',
    titleRu: 'Культурный шок',
    topic: 'culture',
    text: 'When I moved to Japan for work, I experienced a real cultural shock. Everything was different from what I was used to — from the way people greet each other to how they behave on public transport. In Japan, it is considered rude to talk on the phone on a train, and people always queue in perfect order. At first, I found these strict social rules exhausting. However, after a few months, I began to appreciate the respect and consideration that these customs represent. I also struggled with the language barrier, even though many signs have English translations. The hardest part was understanding the unspoken rules — things nobody explains but everyone follows. Looking back, this experience has made me more open-minded and adaptable.',
    textRu: 'Когда я переехал в Японию ради работы, я пережил настоящий культурный шок. Всё отличалось от того, к чему я привык, — от манеры приветствия до поведения в общественном транспорте. В Японии считается невежливым говорить по телефону в поезде, а люди всегда выстраиваются в идеальную очередь. Поначалу эти строгие социальные правила меня утомляли. Но через несколько месяцев я начал ценить уважение и внимательность, которые стоят за этими обычаями. Мне также было трудно из-за языкового барьера, хотя на многих указателях есть перевод на английский. Самым сложным было понять негласные правила — то, что никто не объясняет, но все соблюдают. Оглядываясь назад, этот опыт сделал меня более открытым и гибким.',
    targetWords: ['considered', 'exhausting', 'appreciate', 'barrier', 'adaptable'],
    questions: [
      {
        question: 'Why did the author move to Japan?',
        questionRu: 'Почему автор переехал в Японию?',
        options: ['To study', 'To travel', 'To work', 'To visit family'],
        correctIndex: 2,
      },
      {
        question: 'What was the hardest part of living in Japan for the author?',
        questionRu: 'Что было самым сложным для автора в жизни в Японии?',
        options: ['Learning to cook Japanese food', 'Understanding the unspoken rules', 'Making friends', 'Finding an apartment'],
        correctIndex: 1,
      },
      {
        question: 'How did the experience change the author?',
        questionRu: 'Как этот опыт изменил автора?',
        options: ['They became more strict', 'They became more open-minded and adaptable', 'They decided to stay forever', 'They lost interest in other cultures'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'b1-04',
    level: 'B1',
    title: 'Online Learning',
    titleRu: 'Онлайн-обучение',
    topic: 'education',
    text: 'The pandemic accelerated the shift to online learning in a way that nobody could have predicted. Millions of students around the world suddenly found themselves attending classes through video calls. While some adapted quickly and enjoyed the flexibility of studying from home, others struggled with motivation and loneliness. Teachers, too, had to learn new skills and find creative ways to engage students through a screen. Research suggests that online learning works best when combined with some face-to-face interaction. Students who have regular contact with their teachers and classmates tend to perform better than those who study entirely alone. The future of education will likely be a hybrid model, blending the convenience of digital tools with the irreplaceable value of human connection.',
    textRu: 'Пандемия ускорила переход на онлайн-обучение так, как никто не мог предвидеть. Миллионы студентов по всему миру внезапно начали посещать занятия через видеозвонки. Одни быстро адаптировались и оценили гибкость учёбы из дома, другие столкнулись с проблемами мотивации и одиночеством. Преподавателям тоже пришлось осваивать новые навыки и искать творческие способы вовлечения студентов через экран. Исследования показывают, что онлайн-обучение наиболее эффективно в сочетании с очным взаимодействием. Студенты, которые регулярно общаются с преподавателями и одногруппниками, учатся лучше тех, кто занимается исключительно в одиночку. Будущее образования, скорее всего, за гибридной моделью, сочетающей удобство цифровых инструментов с незаменимой ценностью человеческого общения.',
    targetWords: ['accelerated', 'flexibility', 'motivation', 'engage', 'hybrid'],
    questions: [
      {
        question: 'What does research suggest about online learning?',
        questionRu: 'Что показывают исследования об онлайн-обучении?',
        options: ['It is always better than classroom learning', 'It works best when combined with face-to-face interaction', 'It is only suitable for adults', 'It should replace all traditional education'],
        correctIndex: 1,
      },
      {
        question: 'What problem did some students face with online learning?',
        questionRu: 'С какой проблемой столкнулись некоторые студенты при онлайн-обучении?',
        options: ['Too many homework assignments', 'Lack of motivation and loneliness', 'Expensive equipment', 'Too many exams'],
        correctIndex: 1,
      },
      {
        question: 'What does the author think the future of education will look like?',
        questionRu: 'Каким, по мнению автора, будет будущее образования?',
        options: ['Fully online', 'Fully in classrooms', 'A hybrid model', 'Only for wealthy students'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'b1-05',
    level: 'B1',
    title: 'The Job Interview',
    titleRu: 'Собеседование',
    topic: 'career',
    text: 'Preparing for a job interview can be stressful, but good preparation makes a huge difference. Before the interview, it is important to research the company thoroughly — understand what they do, their values, and recent projects. You should also prepare answers to common questions, such as "Why do you want this job?" and "What are your strengths and weaknesses?" During the interview, body language matters as much as your words. Making eye contact, sitting up straight, and offering a firm handshake all create a positive impression. One common mistake is not asking any questions at the end. Interviewers expect candidates to show genuine curiosity about the role. Finally, always send a short thank-you email after the interview — it shows professionalism and can set you apart from other candidates.',
    textRu: 'Подготовка к собеседованию может быть стрессовой, но хорошая подготовка имеет огромное значение. Перед собеседованием важно тщательно изучить компанию — понять, чем она занимается, каковы её ценности и последние проекты. Также стоит подготовить ответы на типичные вопросы, например «Почему вы хотите эту работу?» и «Каковы ваши сильные и слабые стороны?». Во время собеседования язык тела важен не меньше слов. Зрительный контакт, прямая осанка и крепкое рукопожатие создают положительное впечатление. Распространённая ошибка — не задавать вопросов в конце. Интервьюеры ожидают от кандидатов искреннего интереса к должности. И наконец, всегда отправляйте короткое благодарственное письмо после собеседования — это показывает профессионализм и помогает выделиться среди других кандидатов.',
    targetWords: ['thoroughly', 'strengths', 'impression', 'genuine', 'professionalism'],
    questions: [
      {
        question: 'What should you do before a job interview?',
        questionRu: 'Что нужно сделать перед собеседованием?',
        options: ['Memorize the entire company website', 'Research the company thoroughly', 'Call the interviewer in advance', 'Prepare a long speech about yourself'],
        correctIndex: 1,
      },
      {
        question: 'What common mistake do candidates make?',
        questionRu: 'Какую распространённую ошибку допускают кандидаты?',
        options: ['Arriving too early', 'Wearing formal clothes', 'Not asking any questions at the end', 'Talking about salary'],
        correctIndex: 2,
      },
      {
        question: 'Why should you send a thank-you email after the interview?',
        questionRu: 'Зачем отправлять благодарственное письмо после собеседования?',
        options: ['It is required by law', 'It shows professionalism and helps you stand out', 'It guarantees you the job', 'The interviewer will feel guilty otherwise'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'b1-06',
    level: 'B1',
    title: 'Sleep and Health',
    titleRu: 'Сон и здоровье',
    topic: 'psychology/health',
    text: 'Most adults need between seven and nine hours of sleep per night, yet millions of people regularly get far less than that. The consequences of poor sleep go beyond feeling tired the next day. Chronic sleep deprivation has been linked to serious health problems, including heart disease, obesity, and depression. It also affects concentration, memory, and decision-making, which can have a significant impact on work and daily life. One reason many people sleep badly is their use of electronic devices before bed. The blue light emitted by phone and laptop screens suppresses the production of melatonin, the hormone that regulates sleep. Experts recommend establishing a consistent bedtime routine, avoiding caffeine in the afternoon, and keeping the bedroom dark and cool. Small changes in habits can lead to dramatic improvements in sleep quality.',
    textRu: 'Большинству взрослых нужно от семи до девяти часов сна в сутки, но миллионы людей регулярно спят гораздо меньше. Последствия плохого сна выходят далеко за рамки усталости на следующий день. Хроническое недосыпание связано с серьёзными проблемами со здоровьем, включая болезни сердца, ожирение и депрессию. Оно также влияет на концентрацию, память и принятие решений, что может существенно сказаться на работе и повседневной жизни. Одна из причин, почему многие плохо спят, — использование электронных устройств перед сном. Синий свет экранов телефонов и ноутбуков подавляет выработку мелатонина — гормона, регулирующего сон. Эксперты советуют установить постоянный режим отхода ко сну, избегать кофеина во второй половине дня и держать спальню тёмной и прохладной. Небольшие изменения привычек могут привести к значительному улучшению качества сна.',
    targetWords: ['deprivation', 'concentration', 'emitted', 'suppresses', 'consistent'],
    questions: [
      {
        question: 'How much sleep do most adults need?',
        questionRu: 'Сколько сна нужно большинству взрослых?',
        options: ['Five to six hours', 'Six to seven hours', 'Seven to nine hours', 'Nine to eleven hours'],
        correctIndex: 2,
      },
      {
        question: 'Why does using a phone before bed affect sleep?',
        questionRu: 'Почему использование телефона перед сном влияет на сон?',
        options: ['The noise keeps you awake', 'The blue light suppresses melatonin production', 'The phone gets too warm', 'Social media causes nightmares'],
        correctIndex: 1,
      },
      {
        question: 'What do experts NOT recommend for better sleep?',
        questionRu: 'Что эксперты НЕ рекомендуют для лучшего сна?',
        options: ['A consistent bedtime routine', 'Avoiding caffeine in the afternoon', 'Drinking coffee before bed', 'Keeping the bedroom dark and cool'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'b1-07',
    level: 'B1',
    title: 'Space Exploration',
    titleRu: 'Исследование космоса',
    topic: 'science',
    text: 'Humanity has always been fascinated by the stars, but space exploration has entered a remarkable new phase. Private companies are now working alongside government agencies to push the boundaries of what is possible. Reusable rockets have dramatically reduced the cost of launching satellites and supplying the International Space Station. There is even serious talk of establishing a permanent colony on Mars within the next few decades. However, the challenges are enormous. Astronauts on a Mars mission would face extreme isolation, radiation exposure, and the psychological strain of being millions of kilometres from Earth. Despite these obstacles, thousands of volunteers have already signed up for potential Mars missions. Whether or not we reach Mars soon, the technology being developed for space exploration is already benefiting life on Earth, from improved medical imaging to better water purification systems.',
    textRu: 'Человечество всегда было очаровано звёздами, но освоение космоса вступило в новый удивительный этап. Частные компании теперь работают наравне с государственными агентствами, расширяя границы возможного. Многоразовые ракеты значительно снизили стоимость запуска спутников и снабжения Международной космической станции. Всерьёз обсуждается создание постоянной колонии на Марсе в ближайшие десятилетия. Однако трудности огромны. Астронавты марсианской миссии столкнутся с полной изоляцией, радиационным облучением и психологическим давлением нахождения в миллионах километров от Земли. Несмотря на эти препятствия, тысячи добровольцев уже записались на возможные марсианские миссии. Независимо от того, доберёмся ли мы скоро до Марса, технологии, разрабатываемые для космоса, уже приносят пользу на Земле — от улучшенной медицинской визуализации до более совершенных систем очистки воды.',
    targetWords: ['fascinated', 'boundaries', 'isolation', 'obstacles', 'benefiting'],
    questions: [
      {
        question: 'What has reduced the cost of space launches?',
        questionRu: 'Что снизило стоимость космических запусков?',
        options: ['Government funding', 'Reusable rockets', 'Smaller satellites', 'International cooperation'],
        correctIndex: 1,
      },
      {
        question: 'What challenges would astronauts face on a Mars mission?',
        questionRu: 'С какими трудностями столкнулись бы астронавты на марсианской миссии?',
        options: ['Lack of food and water only', 'Extreme isolation, radiation, and psychological strain', 'Too many other astronauts', 'Equipment that is too heavy'],
        correctIndex: 1,
      },
      {
        question: 'How is space technology benefiting life on Earth?',
        questionRu: 'Как космические технологии приносят пользу жизни на Земле?',
        options: ['It provides free internet', 'Through improved medical imaging and water purification', 'It creates new jobs in space', 'It helps predict earthquakes'],
        correctIndex: 1,
      },
    ],
  },

  {
    id: 'b1-08',
    level: 'B1',
    title: 'Fake News',
    titleRu: 'Фейковые новости',
    topic: 'media',
    text: 'In the age of social media, misinformation can spread faster than ever before. A sensational headline can reach millions of people within hours, often before anyone has checked whether it is actually true. This phenomenon, commonly known as "fake news", has become a serious problem for democratic societies. People tend to share articles that confirm their existing beliefs without reading beyond the headline. Social media algorithms make the problem worse by creating filter bubbles that show users only content they are likely to agree with. Fighting fake news requires a combination of media literacy education, responsible journalism, and better platform design. Individuals can protect themselves by checking multiple sources, looking for evidence, and being sceptical of stories that seem too dramatic or emotional. Critical thinking has never been more important than it is today.',
    textRu: 'В эпоху социальных сетей дезинформация распространяется быстрее, чем когда-либо. Сенсационный заголовок может достичь миллионов людей за считанные часы, часто прежде, чем кто-либо проверит его достоверность. Это явление, обычно называемое «фейковыми новостями», стало серьёзной проблемой для демократических обществ. Люди склонны делиться статьями, которые подтверждают их существующие убеждения, не читая дальше заголовка. Алгоритмы социальных сетей усугубляют проблему, создавая информационные пузыри, которые показывают пользователям только тот контент, с которым они, вероятно, согласятся. Борьба с фейковыми новостями требует сочетания медиаграмотности, ответственной журналистики и более продуманного дизайна платформ. Каждый может защитить себя, проверяя несколько источников, ища доказательства и скептически относясь к историям, которые кажутся слишком драматичными или эмоциональными. Критическое мышление ещё никогда не было так важно, как сегодня.',
    targetWords: ['misinformation', 'phenomenon', 'algorithms', 'sceptical', 'critical thinking'],
    questions: [
      {
        question: 'What are "filter bubbles"?',
        questionRu: 'Что такое «информационные пузыри»?',
        options: ['A type of internet virus', 'Content that shows users only things they agree with', 'A way to block fake news', 'A social media marketing tool'],
        correctIndex: 1,
      },
      {
        question: 'What tendency do people have when sharing articles?',
        questionRu: 'Какую склонность проявляют люди при распространении статей?',
        options: ['They share everything they see', 'They share articles that confirm their beliefs', 'They only share verified news', 'They never share anything online'],
        correctIndex: 1,
      },
      {
        question: 'According to the text, how can individuals protect themselves from fake news?',
        questionRu: 'Согласно тексту, как люди могут защитить себя от фейковых новостей?',
        options: ['By avoiding social media entirely', 'By only reading one trusted newspaper', 'By checking multiple sources and being sceptical', 'By using special software'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'b1-09',
    level: 'B1',
    title: 'Volunteering',
    titleRu: 'Волонтёрство',
    topic: 'community',
    text: 'Three years ago, I started volunteering at a local shelter for homeless people. At first, I was nervous because I did not know what to expect. My role was simple — I helped serve meals on Saturday mornings and occasionally sorted donated clothing. Over time, I got to know some of the regular visitors and heard their stories. Many of them had lost their jobs or gone through difficult personal situations that could happen to anyone. This experience completely changed my perspective on homelessness. I realised that it is not always the result of poor choices — sometimes life is simply unfair. Volunteering has also given me a sense of purpose and taught me skills I never expected to learn, like teamwork, patience, and empathy. I would encourage anyone who has a few spare hours a week to find a cause they care about and get involved.',
    textRu: 'Три года назад я начал волонтёрить в местном приюте для бездомных. Поначалу я нервничал, потому что не знал, чего ожидать. Моя роль была простой — я помогал раздавать еду по субботам утром и иногда сортировал пожертвованную одежду. Со временем я познакомился с некоторыми постоянными посетителями и услышал их истории. Многие из них потеряли работу или пережили тяжёлые личные ситуации, которые могут случиться с каждым. Этот опыт полностью изменил мой взгляд на бездомность. Я понял, что это не всегда результат плохих решений — иногда жизнь просто несправедлива. Волонтёрство также дало мне чувство цели и научило навыкам, которых я не ожидал: работа в команде, терпение и эмпатия. Я бы посоветовал каждому, у кого есть несколько свободных часов в неделю, найти дело по душе и начать помогать.',
    targetWords: ['shelter', 'donated', 'perspective', 'empathy', 'involved'],
    questions: [
      {
        question: 'What does the author do as a volunteer?',
        questionRu: 'Чем автор занимается как волонтёр?',
        options: ['Teaches English to immigrants', 'Helps serve meals and sorts clothing', 'Builds houses for homeless people', 'Drives people to appointments'],
        correctIndex: 1,
      },
      {
        question: 'How did volunteering change the author\'s view on homelessness?',
        questionRu: 'Как волонтёрство изменило взгляд автора на бездомность?',
        options: ['They realised homeless people are lazy', 'They understood it can happen to anyone', 'They decided it is not a real problem', 'They thought the government should do more'],
        correctIndex: 1,
      },
      {
        question: 'What skills did the author gain from volunteering?',
        questionRu: 'Какие навыки автор приобрёл благодаря волонтёрству?',
        options: ['Cooking and cleaning', 'Computer skills', 'Teamwork, patience, and empathy', 'Leadership and public speaking'],
        correctIndex: 2,
      },
    ],
  },

  {
    id: 'b1-10',
    level: 'B1',
    title: 'The Future of Work',
    titleRu: 'Будущее работы',
    topic: 'career/tech',
    text: 'The way we work is changing rapidly, driven by advances in artificial intelligence and automation. Some experts predict that up to forty percent of current jobs could be automated within the next twenty years. This does not necessarily mean mass unemployment, but it does mean that workers will need to adapt. Jobs that involve routine tasks, such as data entry, basic accounting, and assembly-line work, are most at risk. On the other hand, roles that require creativity, emotional intelligence, and complex problem-solving are likely to grow. Many companies have already embraced remote work, and the traditional nine-to-five office schedule is becoming less common. Continuous learning will be essential — the idea of training for one career and doing it for life is quickly becoming outdated. Those who are willing to develop new skills and embrace change will have the best opportunities in the future job market.',
    textRu: 'Характер работы стремительно меняется под влиянием достижений в области искусственного интеллекта и автоматизации. Некоторые эксперты прогнозируют, что до сорока процентов нынешних рабочих мест могут быть автоматизированы в ближайшие двадцать лет. Это не обязательно означает массовую безработицу, но работникам придётся адаптироваться. Больше всего рискуют профессии, связанные с рутинными задачами: ввод данных, базовая бухгалтерия, работа на конвейере. С другой стороны, профессии, требующие креативности, эмоционального интеллекта и сложного решения проблем, скорее всего, будут расти. Многие компании уже перешли на удалённую работу, а традиционный офисный график с девяти до пяти становится менее распространённым. Непрерывное обучение станет необходимостью — идея выучиться одной профессии на всю жизнь быстро устаревает. Те, кто готов осваивать новые навыки и принимать перемены, получат лучшие возможности на рынке труда будущего.',
    targetWords: ['automation', 'predict', 'routine', 'embraced', 'outdated'],
    questions: [
      {
        question: 'Which types of jobs are most at risk of automation?',
        questionRu: 'Какие профессии больше всего подвержены риску автоматизации?',
        options: ['Creative jobs', 'Jobs involving routine tasks', 'Jobs requiring emotional intelligence', 'Management positions'],
        correctIndex: 1,
      },
      {
        question: 'What does the author say about the idea of one career for life?',
        questionRu: 'Что автор говорит об идее одной профессии на всю жизнь?',
        options: ['It is still the best approach', 'It is quickly becoming outdated', 'It only applies to certain fields', 'It has always been a myth'],
        correctIndex: 1,
      },
      {
        question: 'According to the text, who will have the best opportunities in the future?',
        questionRu: 'Согласно тексту, у кого будут лучшие возможности в будущем?',
        options: ['People with the most experience', 'People willing to develop new skills and embrace change', 'People who work in technology', 'People with university degrees'],
        correctIndex: 1,
      },
    ],
  },
];
