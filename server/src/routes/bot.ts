import type { FastifyInstance } from 'fastify';

const WEB_APP_URL = 'https://wordy-lang.ru';

type TelegramUpdate = {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
};

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

export async function setupBot() {
  const token = process.env.BOT_TOKEN;
  if (!token || process.env.NODE_ENV !== 'production') return;

  // Set webhook
  const webhookUrl = `${WEB_APP_URL}/api/bot/webhook`;
  await callTelegramApi('setWebhook', {
    url: webhookUrl,
    allowed_updates: ['message'],
  });

  // Set menu button
  await callTelegramApi('setChatMenuButton', {
    menu_button: {
      type: 'web_app',
      text: 'Играть',
      web_app: { url: WEB_APP_URL },
    },
  });

  console.log('Telegram bot webhook and menu button configured');
}

export default async function botRoutes(app: FastifyInstance) {
  app.post<{ Body: TelegramUpdate }>('/api/bot/webhook', async (request, reply) => {
    const { message } = request.body;

    if (message?.text === '/start') {
      const name = message.from?.first_name ?? '';

      await callTelegramApi('sendMessage', {
        chat_id: message.chat.id,
        text: `Привет${name ? `, ${name}` : ''}! 👋\n\nWordy — учи английские слова в игровой форме. Квизы, рейтинги, дуэли с друзьями.\n\nНажми кнопку ниже, чтобы начать!`,
        reply_markup: {
          inline_keyboard: [[
            { text: '🚀 Открыть Wordy', web_app: { url: WEB_APP_URL } },
          ]],
        },
      });
    }

    return reply.status(200).send({ ok: true });
  });
}
