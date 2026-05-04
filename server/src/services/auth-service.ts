import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { REVERSE_TRIAL_MS } from '../config/premium-config.js';

type TelegramUserData = {
  id: bigint;
  username?: string;
  first_name: string;
  photo_url?: string;
};

export function validateInitData(initData: string, botToken: string): TelegramUserData {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new Error('Missing hash in initData');
  }

  params.delete('hash');
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (computedHash !== hash) {
    throw new Error('Invalid initData signature');
  }

  const userParam = params.get('user');
  if (!userParam) {
    throw new Error('Missing user in initData');
  }

  return JSON.parse(userParam) as TelegramUserData;
}

export async function upsertUser(data: TelegramUserData) {
  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, data.id),
  });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        username: data.username ?? null,
        firstName: data.first_name,
        avatarUrl: data.photo_url ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.telegramId, data.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(users)
    .values({
      telegramId: data.id,
      username: data.username ?? null,
      firstName: data.first_name,
      avatarUrl: data.photo_url ?? null,
      premiumUntil: new Date(Date.now() + REVERSE_TRIAL_MS),
      premiumPlan: 'trial',
      estimatedCefr: 'a2',
    })
    .returning();
  return created!;
}

export async function getOrCreateDevUser() {
  const devTelegramId = 1n;

  const existing = await db.query.users.findFirst({
    where: eq(users.telegramId, devTelegramId),
  });

  if (existing) return existing;

  const [created] = await db
    .insert(users)
    .values({
      telegramId: devTelegramId,
      firstName: 'Dev User',
      username: 'dev_user',
      estimatedCefr: 'a2',
    })
    .returning();
  return created!;
}
