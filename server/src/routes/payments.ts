import type { FastifyInstance } from 'fastify';
import { createPayment, handleWebhook } from '../services/payment-service.js';
import { getPremiumStatus } from '../services/premium-service.js';
import { PAYMENT_ITEMS, RETURN_URL_WEBAPP } from '../config/payment-config.js';

export default async function paymentRoutes(app: FastifyInstance) {
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
    return getPremiumStatus(request.user.id);
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
