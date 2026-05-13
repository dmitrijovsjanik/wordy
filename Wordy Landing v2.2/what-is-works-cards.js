const howItWorksCards = [
  {
    icon: 'assets/decor vector 01.svg',
    title: 'Интервальные </br> повторения',
    description: 'Умный алгоритм показывает слова именно тогда, когда вы вот-вот их забудете. 6 уровней запоминания: от 1 дня до 60 дней между повторениями.'
  },
  {
    icon: 'assets/decor vector 02.svg',
    title: 'Автоматический </br> перевод',
    description: 'Введите слово на английском или русском - получите качественный перевод с транскрипцией. Поддержка IPA и русской фонетики.'
  },
  {
    icon: 'assets/decor vector 03.svg',
    title: 'Два режима </br> обучения',
    description: 'Algorithm mode –– учите по расписанию с отслеживанием прогресса. </br> Practice mode –– свободная практика для закрепления.'
  },
  {
    icon: 'assets/decor vector 04.svg',
    title: 'Двунаправленные</br> квизы',
    description: 'Тренируйте перевод в обе стороны: с английского на русский и наоборот. 4 варианта ответа для лучшего запоминания.'
  },
  {
    icon: 'assets/decor vector 05.svg',
    title: 'Ваш личный </br> словарь',
    description: 'Тренируйте перевод в обе стороны: с английского на русский и наоборот. 4 варианта ответа для лучшего запоминания.'
  },
  {
    icon: 'assets/decor vector 06.svg',
    title: 'Прямо в </br> Telegram',
    description: 'Не нужно устанавливать отдельное приложение. Telegram Mini App работает быстро и доступен с любого устройства.'
  }
];

function createHowItWorksCard(card) {
  return `
      <div class="card card--what-is">
          <div class="card__header">
            <h3 class="card__title pointer-events-none">
              ${card.title}
            </h3>
            <img class="card__decor--what-is" src="${card.icon}" alt="" />
          </div>
          <p class="card__p pointer-events-none">
            ${card.description}
          </p>
        </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('how-it-works-cards');
  if (!container) return;

  container.innerHTML = howItWorksCards
    .map(createHowItWorksCard)
    .join('');
});