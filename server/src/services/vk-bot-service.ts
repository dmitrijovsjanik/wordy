/**
 * VK Bot Service — отправка сообщений через VK API.
 */

type VkKeyboardButton = {
  action: {
    type: 'text' | 'open_link' | 'open_app';
    label?: string;
    link?: string;
    app_id?: number;
    hash?: string;
    payload?: string;
  };
  color?: 'primary' | 'secondary' | 'negative' | 'positive';
};

type VkKeyboard = {
  one_time?: boolean;
  inline?: boolean;
  buttons: VkKeyboardButton[][];
};

async function callVkApi(method: string, params: Record<string, unknown>) {
  const token = process.env.VK_GROUP_TOKEN;
  if (!token) return null;

  const body = new URLSearchParams();
  body.append('access_token', token);
  body.append('v', '5.199');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      body.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
    }
  }

  const res = await fetch(`https://api.vk.com/method/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  return res.json() as Promise<unknown>;
}

export async function sendVkMessage(
  peerId: number,
  message: string,
  keyboard?: VkKeyboard,
) {
  return callVkApi('messages.send', {
    peer_id: peerId,
    message,
    random_id: Math.floor(Math.random() * 2147483647),
    keyboard: keyboard ? JSON.stringify(keyboard) : undefined,
  });
}

export async function notifyVkPaymentSuccess(peerId: number) {
  await sendVkMessage(peerId, 'Оплата прошла успешно! Покупка активирована в вашем аккаунте Wordy.');
}

export async function notifyVkPaymentFailed(peerId: number) {
  await sendVkMessage(peerId, 'К сожалению, оплата не прошла. Попробуйте ещё раз или обратитесь в поддержку: wordylang@mail.ru');
}

export { type VkKeyboard, type VkKeyboardButton };
