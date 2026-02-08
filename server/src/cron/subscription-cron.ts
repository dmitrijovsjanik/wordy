import cron from 'node-cron';
import { and, eq, lte, isNotNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { createRecurringPayment } from '../services/payment-service.js';

// Каждый день в 09:00 UTC (12:00 MSK) — проверяем подписки, истекающие в ближайшие 24ч
cron.schedule(
  '0 9 * * *',
  async () => {
    console.log('[Subscription Cron] Checking expiring premium subscriptions...');
    try {
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const expiring = await db.query.users.findMany({
        where: and(
          eq(users.autoRenew, true),
          isNotNull(users.savedPaymentMethodId),
          isNotNull(users.premiumUntil),
          lte(users.premiumUntil, in24h),
        ),
        columns: {
          id: true,
          telegramId: true,
          premiumPlan: true,
          savedPaymentMethodId: true,
        },
      });

      if (expiring.length === 0) {
        console.log('[Subscription Cron] No expiring subscriptions found');
        return;
      }

      console.log(`[Subscription Cron] Found ${expiring.length} expiring subscription(s)`);

      for (const user of expiring) {
        const itemType = user.premiumPlan === 'year' ? 'premium_year' : 'premium_month';

        try {
          const paymentId = await createRecurringPayment(
            user.id,
            itemType,
            user.savedPaymentMethodId!,
            Number(user.telegramId),
          );
          console.log(`[Subscription Cron] Recurring payment created for user ${user.id}: ${paymentId}`);
        } catch (error) {
          console.error(`[Subscription Cron] Failed to create recurring payment for user ${user.id}:`, error);
          // Отключаем автопродление при ошибке создания платежа
          await db
            .update(users)
            .set({ autoRenew: false })
            .where(eq(users.id, user.id));
        }
      }
    } catch (error) {
      console.error('[Subscription Cron] Error:', error);
    }
  },
  { timezone: 'UTC' },
);

console.log('[Subscription Cron] Scheduled: "0 9 * * *" UTC (12:00 MSK daily)');
