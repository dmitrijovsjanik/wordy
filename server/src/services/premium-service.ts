import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

export async function isPremium(userId: number): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { premiumUntil: true },
  });

  if (!user?.premiumUntil) return false;
  return user.premiumUntil > new Date();
}

export async function getPremiumStatus(userId: number): Promise<{
  isPremium: boolean;
  premiumUntil: string | null;
  premiumPlan: string | null;
}> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { premiumUntil: true, premiumPlan: true },
  });

  const active = !!user?.premiumUntil && user.premiumUntil > new Date();

  return {
    isPremium: active,
    premiumUntil: active && user?.premiumUntil ? user.premiumUntil.toISOString() : null,
    premiumPlan: active && user?.premiumPlan ? user.premiumPlan : null,
  };
}
