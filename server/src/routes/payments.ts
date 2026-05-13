import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { createPayment, handleWebhook } from '../services/payment-service.js';
import { getPremiumStatus } from '../services/premium-service.js';
import { PAYMENT_ITEMS, RETURN_URL_WEBAPP } from '../config/payment-config.js';
import { PILOT_FEATURES } from '../config/pilot-config.js';

export default async function paymentRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    // Webhook от платёжного провайдера должен работать (для существующих
    // платежей до пилота) — пропускаем только endpoint оформления.
    if (!PILOT_FEATURES.payments && request.routeOptions.url === '/api/payments/create') {
      return reply.code(403).send({ error: 'Платежи недоступны', code: 'PAYMENTS_DISABLED' });
    }
  });

  // Создать платёж (из Mini App)
  app.post<{
    Body: { itemType: string };
  }>('/api/payments/create', { onRequest: [app.authenticate] }, async (request, reply) => {
    const { itemType } = request.body;

    if (!itemType || !PAYMENT_ITEMS[itemType]) {
      return reply.code(400).send({ error: 'Недопустимый товар', code: 'INVALID_ITEM' });
    }

    try {
      const result = await createPayment({
        userId: request.user.id,
        itemType,
        returnUrl: RETURN_URL_WEBAPP,
      });
      return { confirmationUrl: result.confirmationUrl, paymentId: result.paymentId };
    } catch (error) {
      console.error('[payment] Create error:', error);
      return reply.code(500).send({ error: 'Ошибка создания платежа', code: 'PAYMENT_ERROR' });
    }
  });

  // Статус Premium подписки
  app.get('/api/payments/premium', { onRequest: [app.authenticate] }, async (request) => {
    const status = await getPremiumStatus(request.user.id);

    const user = await db.query.users.findFirst({
      where: eq(users.id, request.user.id),
      columns: { autoRenew: true, savedPaymentMethodId: true },
    });

    return { ...status, autoRenew: user?.autoRenew ?? false, hasCard: !!user?.savedPaymentMethodId };
  });

  // Отключить автопродление
  app.post('/api/payments/cancel-auto-renew', { onRequest: [app.authenticate] }, async (request) => {
    await db
      .update(users)
      .set({ autoRenew: false })
      .where(eq(users.id, request.user.id));

    return { ok: true };
  });

  // Включить автопродление (только если есть сохранённый способ оплаты)
  app.post('/api/payments/enable-auto-renew', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = await db.query.users.findFirst({
      where: eq(users.id, request.user.id),
      columns: { savedPaymentMethodId: true },
    });

    if (!user?.savedPaymentMethodId) {
      return reply.code(400).send({ error: 'Нет сохранённого способа оплаты', code: 'NO_PAYMENT_METHOD' });
    }

    await db
      .update(users)
      .set({ autoRenew: true })
      .where(eq(users.id, request.user.id));

    return { ok: true };
  });

  // Отвязать карту
  app.post('/api/payments/unlink-card', { onRequest: [app.authenticate] }, async (request) => {
    await db
      .update(users)
      .set({ savedPaymentMethodId: null, autoRenew: false })
      .where(eq(users.id, request.user.id));

    return { ok: true };
  });

  // Webhook от YooKassa (без авторизации)
  app.post('/api/payments/webhook', async (request, reply) => {
    try {
      const body = request.body as Record<string, unknown>;

      if (!body || typeof body !== 'object' || !('event' in body) || !('object' in body)) {
        return reply.code(400).send({ error: 'Invalid webhook body' });
      }

      await handleWebhook(body as Parameters<typeof handleWebhook>[0]);
      return reply.code(200).send({ ok: true });
    } catch (error) {
      console.error('[payment webhook] Error:', error);
      // Всегда 200, чтобы YooKassa не ретраила
      return reply.code(200).send({ ok: true });
    }
  });
}
