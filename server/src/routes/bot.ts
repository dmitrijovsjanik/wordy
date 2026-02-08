import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { createPayment } from '../services/payment-service.js';
import { RETURN_URL_BOT } from '../config/payment-config.js';

const WEB_APP_URL = 'https://wordy-lang.ru';

// ─── Типы ────────────────────────────────────────────────────────────────────

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
  callback_query?: {
    id: string;
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
};

type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; web_app: { url: string } }
  | { text: string; url: string };

// ─── Тексты ──────────────────────────────────────────────────────────────────

function startText(name: string): string {
  return `Привет${name ? `, ${name}` : ''}! 👋\n\nWordy — учи английские слова в игровой форме. Квизы, рейтинги, дуэли с друзьями.\n\nНажми кнопку ниже, чтобы начать!`;
}

const CATALOG_TEXT = `🛒 *Каталог товаров Wordy*

Все товары — цифровые. Активируются мгновенно после оплаты в вашем аккаунте Wordy.

Выберите категорию:`;

const PREMIUM_TEXT = `⭐ *Wordy Premium*

• Безлимит коллекций и слов — создавайте сколько угодно
• x2 ежедневные награды — кристаллы за активность удваиваются
• +15% к опыту — быстрее повышайте уровень
• Заморозка стрика — одна бесплатная в неделю

📌 Цифровой товар. Активируется мгновенно после оплаты.`;

const FREEZES_TEXT = `❄️ *Заморозка стрика*

Защищает ваш стрик дней. Если пропустите день — заморозка потратится автоматически и стрик сохранится. Можно накопить несколько на случай отпуска.

📌 Цифровой товар. Активируется мгновенно после оплаты.`;

const CONTACTS_TEXT = `📞 *Контакты*

Овсяник Дмитрий Александрович (самозанятый)
ИНН: 371122814322
Email: wordylang@mail.ru

Wordy — Telegram Mini App для изучения английских слов. Квизы, дуэли, рейтинги, система уровней и опыта.`;

const OFFER_TEXT = `📄 *Публичная оферта на оказание платных услуг в приложении Wordy*

*1. Общие положения*
1.1. Настоящая оферта является официальным предложением Овсяник Дмитрий Александрович (самозанятый) (далее — Исполнитель) заключить договор на оказание платных цифровых услуг в приложении Wordy (далее — Сервис).
1.2. Сервис — Telegram Mini App для изучения английских слов в игровой форме.
1.3. Акцепт оферты — совершение оплаты любого товара или услуги в Сервисе.

*2. Предмет оферты*
Исполнитель предоставляет Пользователю доступ к платным цифровым услугам Сервиса: подписка Premium и пакеты заморозки стрика.

*3. Описание услуг и цены*
Подписка Wordy Premium:
• 1 месяц — 299 ₽
• 12 месяцев — 2 388 ₽ (199 ₽/мес)
Преимущества: безлимит коллекций и слов, x2 ежедневные награды, +15% к опыту, еженедельная заморозка стрика.

Заморозка стрика:
• 1 день — 49 ₽
• 2 дня — 79 ₽
• 7 дней — 249 ₽
• 14 дней — 449 ₽

*4. Порядок оплаты*
Оплата производится через платёжный сервис ЮКасса. Подписка продлевается автоматически с возможностью отмены. Пакеты заморозки — разовая покупка.

*5. Порядок оказания услуг*
Все товары являются цифровыми и активируются автоматически в аккаунте Пользователя сразу после подтверждения оплаты. Подписка действует с момента оплаты на оплаченный период. Заморозки зачисляются мгновенно и действуют бессрочно.

*6. Возврат средств*
Подписка: возврат за неиспользованный период при обращении на wordylang@mail.ru.
Пакеты заморозки: возврат в течение 14 дней, если товар не был использован.

*7. Ответственность сторон*
Исполнитель не несёт ответственности за перебои в работе Сервиса, вызванные техническими причинами или действиями третьих лиц. Пользователь несёт ответственность за сохранность данных своего аккаунта.

*8. Прочие условия*
Исполнитель вправе изменять цены и условия оферты с уведомлением за 30 дней. Споры решаются путём переговоров.

*9. Реквизиты Исполнителя*
Овсяник Дмитрий Александрович (самозанятый)
ИНН: 371122814322
Email: wordylang@mail.ru`;

// ─── Клавиатуры ──────────────────────────────────────────────────────────────

const START_KEYBOARD: InlineKeyboardButton[][] = [
  [{ text: '🚀 Открыть Wordy', web_app: { url: WEB_APP_URL } }],
  [{ text: '🛒 Каталог товаров', callback_data: 'catalog' }],
  [
    { text: '📄 Оферта', callback_data: 'offer' },
    { text: '📞 Контакты', callback_data: 'contacts' },
  ],
];

const CATALOG_KEYBOARD: InlineKeyboardButton[][] = [
  [{ text: '⭐ Подписка Premium', callback_data: 'product_premium' }],
  [{ text: '❄️ Заморозка стрика', callback_data: 'product_freezes' }],
  [{ text: '⬅️ Назад', callback_data: 'start' }],
];

const PREMIUM_KEYBOARD: InlineKeyboardButton[][] = [
  [{ text: '1 месяц — 299 ₽', callback_data: 'buy_premium_month' }],
  [{ text: '12 месяцев — 2 388 ₽ (199 ₽/мес, -33%)', callback_data: 'buy_premium_year' }],
  [{ text: '⬅️ Назад к каталогу', callback_data: 'catalog' }],
];

const FREEZES_KEYBOARD: InlineKeyboardButton[][] = [
  [
    { text: '1 день — 49 ₽', callback_data: 'buy_freeze_1' },
    { text: '2 дня — 79 ₽', callback_data: 'buy_freeze_2' },
  ],
  [
    { text: '7 дней — 249 ₽', callback_data: 'buy_freeze_7' },
    { text: '14 дней — 449 ₽', callback_data: 'buy_freeze_14' },
  ],
  [{ text: '⬅️ Назад к каталогу', callback_data: 'catalog' }],
];

const CONTACTS_KEYBOARD: InlineKeyboardButton[][] = [
  [{ text: '✉️ Написать на email', url: 'mailto:wordylang@mail.ru' }],
  [{ text: '⬅️ Назад', callback_data: 'start' }],
];

const OFFER_BACK_KEYBOARD: InlineKeyboardButton[][] = [
  [{ text: '⬅️ Назад', callback_data: 'start' }],
];

// ─── Хелперы ─────────────────────────────────────────────────────────────────

async function callTelegramApi(method: string, body: Record<string, unknown>) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return res.json();
}

async function sendScreen(chatId: number, text: string, keyboard: InlineKeyboardButton[][]) {
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function editScreen(chatId: number, messageId: number, text: string, keyboard: InlineKeyboardButton[][]) {
  await callTelegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard },
  });
}

// ─── Настройка бота ──────────────────────────────────────────────────────────

export async function setupBot() {
  const token = process.env.BOT_TOKEN;
  if (!token || process.env.NODE_ENV !== 'production') return;

  // Set webhook
  const webhookUrl = `${WEB_APP_URL}/api/bot/webhook`;
  await callTelegramApi('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
  });

  // Set menu button
  await callTelegramApi('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Играть',
      web_app: { url: WEB_APP_URL },
    },
  });

  // Set bot commands
  await callTelegramApi('setMyCommands', {
    commands: [
      { command: 'start', description: 'Начать' },
      { command: 'catalog', description: 'Каталог товаров' },
      { command: 'offer', description: 'Условия использования' },
      { command: 'contacts', description: 'Контакты' },
    ],
  });

  console.log('Telegram bot webhook, menu button and commands configured');
}

// ─── Роуты ───────────────────────────────────────────────────────────────────

export default async function botRoutes(app: FastifyInstance) {
  app.post<{ Body: TelegramUpdate }>('/api/bot/webhook', async (request, reply) => {
    const { message, callback_query } = request.body;

    // Текстовые команды
    if (message?.text) {
      const chatId = message.chat.id;
      const command = message.text.split('@')[0]; // strip @botname

      if (command === '/start' || command.startsWith('/start ')) {
        const name = message.from?.first_name ?? '';
        await sendScreen(chatId, startText(name), START_KEYBOARD);
      } else if (command === '/catalog') {
        await sendScreen(chatId, CATALOG_TEXT, CATALOG_KEYBOARD);
      } else if (command === '/offer') {
        await sendScreen(chatId, OFFER_TEXT, OFFER_BACK_KEYBOARD);
      } else if (command === '/contacts') {
        await sendScreen(chatId, CONTACTS_TEXT, CONTACTS_KEYBOARD);
      }
    }

    // Callback-кнопки
    if (callback_query?.data && callback_query.message) {
      const chatId = callback_query.message.chat.id;
      const messageId = callback_query.message.message_id;
      const data = callback_query.data;

      // Покупка через YooKassa
      if (data.startsWith('buy_')) {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callback_query.id,
          text: 'Создаём платёж...',
        });

        const itemTypeMap: Record<string, string> = {
          buy_freeze_1: 'freeze_1',
          buy_freeze_2: 'freeze_2',
          buy_freeze_7: 'freeze_7',
          buy_freeze_14: 'freeze_14',
          buy_premium_month: 'premium_month',
          buy_premium_year: 'premium_year',
        };

        const itemType = itemTypeMap[data];
        if (!itemType) return reply.status(200).send({ ok: true });

        const user = await db.query.users.findFirst({
          where: eq(users.telegramId, BigInt(chatId)),
          columns: { id: true },
        });

        if (!user) {
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: 'Сначала откройте Wordy и зарегистрируйтесь!',
          });
          return reply.status(200).send({ ok: true });
        }

        try {
          const { confirmationUrl } = await createPayment({
            userId: user.id,
            itemType,
            returnUrl: RETURN_URL_BOT,
            telegramChatId: chatId,
          });

          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: '💳 Для оплаты перейдите по ссылке:',
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 Оплатить', url: confirmationUrl }],
                [{ text: '⬅️ Назад к каталогу', callback_data: 'catalog' }],
              ],
            },
          });
        } catch (error) {
          console.error('[bot] Payment creation error:', error);
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: 'Произошла ошибка при создании платежа. Попробуйте позже.',
          });
        }

        return reply.status(200).send({ ok: true });
      }

      // Подтвердить callback (убрать "часики" на кнопке)
      await callTelegramApi('answerCallbackQuery', { callback_query_id: callback_query.id });

      if (data === 'start') {
        await editScreen(chatId, messageId, startText(''), START_KEYBOARD);
      } else if (data === 'catalog') {
        await editScreen(chatId, messageId, CATALOG_TEXT, CATALOG_KEYBOARD);
      } else if (data === 'product_premium') {
        await editScreen(chatId, messageId, PREMIUM_TEXT, PREMIUM_KEYBOARD);
      } else if (data === 'product_freezes') {
        await editScreen(chatId, messageId, FREEZES_TEXT, FREEZES_KEYBOARD);
      } else if (data === 'offer') {
        // Оферта длинная — отправляем новым сообщением вместо editMessage
        await sendScreen(chatId, OFFER_TEXT, OFFER_BACK_KEYBOARD);
      } else if (data === 'contacts') {
        await editScreen(chatId, messageId, CONTACTS_TEXT, CONTACTS_KEYBOARD);
      }
    }

    return reply.status(200).send({ ok: true });
  });
}
