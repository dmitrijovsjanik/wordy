import crypto from 'node:crypto';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { payments, users } from '../db/schema.js';
import { YOOKASSA_API_URL, PAYMENT_ITEMS, RECEIPT_EMAIL } from '../config/payment-config.js';
import { PREMIUM_DURATIONS } from '../config/premium-config.js';

// ─── Types ────────────────────────────────────────────────────────────────

type YookassaPaymentResponse = {
  id: string;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  amount: { value: string; currency: string };
  confirmation?: { type: string; confirmation_url: string };
  payment_method?: { id: string; saved: boolean };
  metadata?: Record<string, string>;
  created_at: string;
};

type CreatePaymentParams = {
  userId: number;
  itemType: string;
  returnUrl: string;
  telegramChatId?: number;
};

type CreatePaymentResult = {
  paymentId: string;
  confirmationUrl: string;
};

type YookassaWebhookBody = {
  type: string;
  event: string;
  object: YookassaPaymentResponse;
};

// ─── YooKassa API ─────────────────────────────────────────────────────────

function getAuth(): string {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;
  if (!shopId || !secretKey) throw new Error('YooKassa credentials not configured');
  return Buffer.from(`${shopId}:${secretKey}`).toString('base64');
}

async function yookassaRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Authorization': `Basic ${getAuth()}`,
    'Content-Type': 'application/json',
  };

  if (idempotencyKey) {
    headers['Idempotence-Key'] = idempotencyKey;
  }

  const res = await fetch(`${YOOKASSA_API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`YooKassa API error: ${res.status} ${JSON.stringify(error)}`);
  }

  return res.json() as Promise<T>;
}

// ─── Create Payment ───────────────────────────────────────────────────────

export async function createPayment({
  userId,
  itemType,
  returnUrl,
  telegramChatId,
}: CreatePaymentParams): Promise<CreatePaymentResult> {
  const item = PAYMENT_ITEMS[itemType];
  if (!item) throw new Error('INVALID_ITEM');

  const idempotencyKey = crypto.randomUUID();

  const isPremium = itemType.startsWith('premium_');

  const paymentBody = {
    amount: {
      value: (item.amount / 100).toFixed(2),
      currency: 'RUB',
    },
    confirmation: {
      type: 'redirect',
      return_url: returnUrl,
    },
    capture: true,
    ...(isPremium ? { save_payment_method: true } : {}),
    description: item.description,
    metadata: {
      user_id: String(userId),
      item_type: itemType,
      ...(telegramChatId ? { telegram_chat_id: String(telegramChatId) } : {}),
    },
    receipt: {
      customer: { email: RECEIPT_EMAIL },
      items: [
        {
          description: item.title,
          quantity: '1.00',
          amount: {
            value: (item.amount / 100).toFixed(2),
            currency: 'RUB',
          },
          vat_code: item.vatCode,
          payment_subject: 'service',
          payment_mode: 'full_payment',
        },
      ],
    },
  };

  const response = await yookassaRequest<YookassaPaymentResponse>(
    'POST',
    '/payments',
    paymentBody,
    idempotencyKey,
  );

  await db.insert(payments).values({
    userId,
    yookassaPaymentId: response.id,
    idempotencyKey,
    status: 'pending',
    itemType: item.itemType as typeof payments.$inferInsert.itemType,
    amount: item.amount,
    description: item.description,
    metadata: telegramChatId ? { telegram_chat_id: String(telegramChatId) } : {},
  });

  if (!response.confirmation?.confirmation_url) {
    throw new Error('YooKassa did not return a confirmation URL');
  }

  return {
    paymentId: response.id,
    confirmationUrl: response.confirmation.confirmation_url,
  };
}

// ─── Webhook Handler ──────────────────────────────────────────────────────

export async function handleWebhook(body: YookassaWebhookBody): Promise<void> {
  const { event, object: paymentData } = body;
  const yookassaPaymentId = paymentData.id;

  const payment = await db.query.payments.findFirst({
    where: eq(payments.yookassaPaymentId, yookassaPaymentId),
  });

  if (!payment) {
    console.error(`[payment] Unknown payment ID from webhook: ${yookassaPaymentId}`);
    return;
  }

  if (payment.status === 'succeeded' && payment.fulfilledAt) {
    return;
  }

  if (event === 'payment.succeeded') {
    await db
      .update(payments)
      .set({
        status: 'succeeded',
        yookassaStatus: paymentData.status,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    await fulfillOrder(payment.id, payment.userId, payment.itemType);

    // Сохраняем способ оплаты для автопродления Premium
    if (
      paymentData.payment_method?.saved &&
      paymentData.payment_method.id &&
      (payment.itemType === 'premium_month' || payment.itemType === 'premium_year')
    ) {
      await db
        .update(users)
        .set({
          savedPaymentMethodId: paymentData.payment_method.id,
          autoRenew: true,
        })
        .where(eq(users.id, payment.userId));
    }

    if (payment.metadata?.telegram_chat_id) {
      await notifyBotPaymentSuccess(Number(payment.metadata.telegram_chat_id), payment.itemType);
    }
  } else if (event === 'payment.canceled') {
    await db
      .update(payments)
      .set({
        status: 'canceled',
        yookassaStatus: paymentData.status,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    // Если рекуррентный платёж отклонён — отключаем автопродление
    if (payment.itemType === 'premium_month' || payment.itemType === 'premium_year') {
      await db
        .update(users)
        .set({ autoRenew: false })
        .where(eq(users.id, payment.userId));

      // Уведомляем пользователя через бот
      if (payment.metadata?.telegram_chat_id) {
        await notifyBotPaymentFailed(Number(payment.metadata.telegram_chat_id));
      }
    }
  }
}

// ─── Order Fulfillment ────────────────────────────────────────────────────

const FREEZE_DAYS_MAP: Record<string, number> = {
  freeze_1: 1,
  freeze_2: 2,
  freeze_7: 7,
  freeze_14: 14,
};

async function fulfillOrder(
  paymentDbId: number,
  userId: number,
  itemType: string,
): Promise<void> {
  // Atomic: только если ещё не исполнен
  const [updated] = await db
    .update(payments)
    .set({ fulfilledAt: new Date(), updatedAt: new Date() })
    .where(and(eq(payments.id, paymentDbId), isNull(payments.fulfilledAt)))
    .returning();

  if (!updated) return; // Уже исполнен другим запросом

  if (itemType in FREEZE_DAYS_MAP) {
    const days = FREEZE_DAYS_MAP[itemType];
    await db
      .update(users)
      .set({ streakFreezes: sql`${users.streakFreezes} + ${days}` })
      .where(eq(users.id, userId));
  } else if (itemType === 'premium_month' || itemType === 'premium_year') {
    const plan = itemType === 'premium_month' ? 'month' : 'year';
    const duration = PREMIUM_DURATIONS[plan];

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { premiumUntil: true },
    });

    const now = new Date();
    const baseDate = user?.premiumUntil && user.premiumUntil > now
      ? user.premiumUntil
      : now;
    const premiumUntil = new Date(baseDate.getTime() + duration);

    await db
      .update(users)
      .set({ premiumUntil, premiumPlan: plan })
      .where(eq(users.id, userId));
  }

  console.log(`[payment] Fulfilled: ${itemType} for user ${userId}`);
}

// ─── Bot Notification ─────────────────────────────────────────────────────

// ─── Recurring Payment ───────────────────────────────────────────────────

export async function createRecurringPayment(
  userId: number,
  itemType: string,
  paymentMethodId: string,
  telegramChatId?: number,
): Promise<string> {
  const item = PAYMENT_ITEMS[itemType];
  if (!item) throw new Error('INVALID_ITEM');

  const idempotencyKey = crypto.randomUUID();

  const paymentBody = {
    amount: {
      value: (item.amount / 100).toFixed(2),
      currency: 'RUB',
    },
    capture: true,
    payment_method_id: paymentMethodId,
    description: `Автопродление: ${item.description}`,
    metadata: {
      user_id: String(userId),
      item_type: itemType,
      ...(telegramChatId ? { telegram_chat_id: String(telegramChatId) } : {}),
    },
    receipt: {
      customer: { email: RECEIPT_EMAIL },
      items: [
        {
          description: item.title,
          quantity: '1.00',
          amount: {
            value: (item.amount / 100).toFixed(2),
            currency: 'RUB',
          },
          vat_code: item.vatCode,
          payment_subject: 'service',
          payment_mode: 'full_payment',
        },
      ],
    },
  };

  const response = await yookassaRequest<YookassaPaymentResponse>(
    'POST',
    '/payments',
    paymentBody,
    idempotencyKey,
  );

  await db.insert(payments).values({
    userId,
    yookassaPaymentId: response.id,
    idempotencyKey,
    status: 'pending',
    itemType: item.itemType as typeof payments.$inferInsert.itemType,
    amount: item.amount,
    description: `Автопродление: ${item.description}`,
    metadata: telegramChatId ? { telegram_chat_id: String(telegramChatId) } : {},
  });

  return response.id;
}

// ─── Bot Notifications ───────────────────────────────────────────────────

async function notifyBotPaymentFailed(chatId: number) {
  const token = process.env.BOT_TOKEN;
  if (!token) return;

  const text = '❌ Не удалось продлить подписку Premium — оплата не прошла.\n\nАвтопродление отключено. Вы можете оформить подписку заново в каталоге.';

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch((err: unknown) => console.error('[bot] Payment failed notification error:', err));
}

async function notifyBotPaymentSuccess(chatId: number, itemType: string) {
  const item = PAYMENT_ITEMS[itemType];
  if (!item) return;

  const token = process.env.BOT_TOKEN;
  if (!token) return;

  const text = `\u2705 Оплата прошла успешно!\n\n${item.title} — активирован.`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch((err: unknown) => console.error('[bot] Payment notification error:', err));
}
