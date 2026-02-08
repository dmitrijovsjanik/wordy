/**
 * YooKassa Payment Configuration
 */

export const YOOKASSA_API_URL = 'https://api.yookassa.ru/v3';

export type PaymentItem = {
  itemType: string;
  title: string;
  amount: number; // копейки
  rubPrice: number;
  description: string;
  vatCode: number;
};

export const PAYMENT_ITEMS: Record<string, PaymentItem> = {
  freeze_1: {
    itemType: 'freeze_1',
    title: 'Заморозка стрика (1 день)',
    amount: 4900,
    rubPrice: 49,
    description: 'Заморозка стрика на 1 день — Wordy',
    vatCode: 1,
  },
  freeze_2: {
    itemType: 'freeze_2',
    title: 'Заморозка стрика (2 дня)',
    amount: 7900,
    rubPrice: 79,
    description: 'Заморозка стрика на 2 дня — Wordy',
    vatCode: 1,
  },
  freeze_7: {
    itemType: 'freeze_7',
    title: 'Заморозка стрика (7 дней)',
    amount: 24900,
    rubPrice: 249,
    description: 'Заморозка стрика на 7 дней — Wordy',
    vatCode: 1,
  },
  freeze_14: {
    itemType: 'freeze_14',
    title: 'Заморозка стрика (14 дней)',
    amount: 44900,
    rubPrice: 449,
    description: 'Заморозка стрика на 14 дней — Wordy',
    vatCode: 1,
  },
  premium_month: {
    itemType: 'premium_month',
    title: 'Подписка Wordy Premium (1 месяц)',
    amount: 29900,
    rubPrice: 299,
    description: 'Подписка Wordy Premium на 1 месяц — Wordy',
    vatCode: 1,
  },
  premium_year: {
    itemType: 'premium_year',
    title: 'Подписка Wordy Premium (12 месяцев)',
    amount: 238800,
    rubPrice: 2388,
    description: 'Подписка Wordy Premium на 12 месяцев — Wordy',
    vatCode: 1,
  },
};

/** Email для чеков 54-ФЗ */
export const RECEIPT_EMAIL = 'wordylang@mail.ru';

/** Return URL после оплаты из Mini App */
export const RETURN_URL_WEBAPP = 'https://wordy-lang.ru/shop?payment=complete';

/** Return URL после оплаты из бота */
export const RETURN_URL_BOT = 'https://t.me/wordylang_bot';
