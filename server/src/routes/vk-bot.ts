import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { sendVkMessage, type VkKeyboard } from '../services/vk-bot-service.js';

const VK_APP_ID = Number(process.env.VK_APP_ID) || 0;

// ─── Тексты ──────────────────────────────────────────────────────────────────

function startText(name: string): string {
  return `Привет${name ? `, ${name}` : ''}!\n\nWordy — учи английские слова в игровой форме. Квизы, рейтинги, дуэли с друзьями.\n\nНажми кнопку ниже, чтобы начать!`;
}

const CONTACTS_TEXT = `Контакты

Овсяник Дмитрий Александрович (самозанятый)
ИНН: 371122814322
Email: wordylang@mail.ru

Wordy — приложение для изучения английских слов.`;

// ─── Клавиатуры ──────────────────────────────────────────────────────────────

function startKeyboard(): VkKeyboard {
  return {
    inline: true,
    buttons: [
      [{
        action: {
          type: 'open_app',
          app_id: VK_APP_ID,
          label: 'Открыть Wordy',
        },
      }],
      [{
        action: {
          type: 'text',
          label: 'Моя подписка',
          payload: JSON.stringify({ command: 'subscription' }),
        },
        color: 'secondary',
      }],
      [{
        action: {
          type: 'text',
          label: 'Контакты',
          payload: JSON.stringify({ command: 'contacts' }),
        },
        color: 'secondary',
      }],
    ],
  };
}

// ─── Типы VK Callback API ───────────────────────────────────────────────────

type VkCallbackEvent = {
  type: string;
  group_id: number;
  secret?: string;
  object?: {
    message?: {
      from_id: number;
      peer_id: number;
      text?: string;
      payload?: string;
    };
  };
};

// ─── Обработчики ─────────────────────────────────────────────────────────────

async function handleMessage(peerId: number, text: string, payload?: string) {
  // Проверяем payload от кнопок
  if (payload) {
    try {
      const parsed = JSON.parse(payload) as { command?: string };
      if (parsed.command === 'subscription') {
        await handleSubscription(peerId);
        return;
      }
      if (parsed.command === 'contacts') {
        await sendVkMessage(peerId, CONTACTS_TEXT);
        return;
      }
    } catch {
      // Невалидный payload — обрабатываем как текст
    }
  }

  const lower = text?.toLowerCase().trim() ?? '';

  if (lower === 'начать' || lower === '/start' || lower === 'start') {
    await sendVkMessage(peerId, startText(''), startKeyboard());
    return;
  }

  if (lower === '/subscription' || lower === 'подписка') {
    await handleSubscription(peerId);
    return;
  }

  if (lower === '/contacts' || lower === 'контакты') {
    await sendVkMessage(peerId, CONTACTS_TEXT);
    return;
  }

  // Неизвестная команда → приветствие
  await sendVkMessage(peerId, startText(''), startKeyboard());
}

async function handleSubscription(peerId: number) {
  const user = await db.query.users.findFirst({
    where: eq(users.vkId, BigInt(peerId)),
    columns: { premiumUntil: true, premiumPlan: true, autoRenew: true },
  });

  if (!user) {
    await sendVkMessage(peerId, 'Вы ещё не зарегистрированы в Wordy. Откройте приложение, чтобы начать!', startKeyboard());
    return;
  }

  if (user.premiumUntil && new Date(user.premiumUntil) > new Date()) {
    const until = new Date(user.premiumUntil).toLocaleDateString('ru-RU');
    const plan = user.premiumPlan === 'year' ? '12 месяцев' : '1 месяц';
    const renew = user.autoRenew ? 'включено' : 'выключено';
    await sendVkMessage(
      peerId,
      `Ваша подписка Premium (${plan}):\nДействует до: ${until}\nАвтопродление: ${renew}`,
    );
  } else {
    await sendVkMessage(peerId, 'У вас нет активной подписки. Оформить подписку можно в приложении.', startKeyboard());
  }
}

// ─── Маршрут ─────────────────────────────────────────────────────────────────

export default async function vkBotRoutes(app: FastifyInstance) {
  app.post('/api/vk-bot/webhook', async (request, reply) => {
    const body = request.body as VkCallbackEvent;

    // Confirmation — VK проверяет webhook
    if (body.type === 'confirmation') {
      const confirmationCode = process.env.VK_CONFIRMATION_CODE;
      if (!confirmationCode) {
        return reply.status(500).send('VK_CONFIRMATION_CODE не настроен');
      }
      return reply.send(confirmationCode);
    }

    // Новое сообщение
    if (body.type === 'message_new' && body.object?.message) {
      const msg = body.object.message;
      // Не блокируем ответ — VK ждёт 'ok' в течение 5 секунд
      handleMessage(msg.peer_id, msg.text ?? '', msg.payload).catch(
        (err) => console.error('[VK Bot] Error handling message:', err),
      );
    }

    // VK ожидает строку 'ok' для подтверждения обработки
    return reply.send('ok');
  });
}
