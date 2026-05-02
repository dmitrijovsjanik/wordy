import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

type VkUserData = {
  vkId: bigint;
  firstName: string;
  avatarUrl?: string;
};

/**
 * Валидация VK launch params через HMAC-SHA256.
 * https://github.com/VKCOM/vk-apps-launch-params
 */
export function validateVkLaunchParams(
  launchParams: string,
  appSecret: string,
): { vkUserId: string; params: Record<string, string> } {
  const formattedParams = launchParams.startsWith('?')
    ? launchParams.slice(1)
    : launchParams;

  let sign: string | undefined;
  const vkParams: { key: string; value: string }[] = [];
  const allParams: Record<string, string> = {};

  for (const param of formattedParams.split('&')) {
    const eqIndex = param.indexOf('=');
    if (eqIndex === -1) continue;
    const key = param.slice(0, eqIndex);
    const value = param.slice(eqIndex + 1);

    allParams[key] = decodeURIComponent(value);

    if (key === 'sign') {
      sign = value;
    } else if (key.startsWith('vk_')) {
      vkParams.push({ key, value });
    }
  }

  if (!sign || vkParams.length === 0) {
    throw new Error('Missing sign or vk_ parameters');
  }

  const queryString = vkParams
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(({ key, value }) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const paramsHash = crypto
    .createHmac('sha256', appSecret)
    .update(queryString)
    .digest()
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  if (paramsHash !== sign) {
    throw new Error('Invalid VK launch params signature');
  }

  const vkUserId = allParams['vk_user_id'];
  if (!vkUserId) {
    throw new Error('Missing vk_user_id in launch params');
  }

  return { vkUserId, params: allParams };
}

/**
 * Получение данных пользователя через VK API (users.get).
 */
export async function fetchVkUserInfo(
  vkUserId: string,
  serviceToken: string,
): Promise<VkUserData> {
  const url = `https://api.vk.com/method/users.get?user_ids=${vkUserId}&fields=photo_200&access_token=${serviceToken}&v=5.199`;

  const response = await fetch(url);
  const data = (await response.json()) as {
    response?: { id: number; first_name: string; photo_200?: string }[];
    error?: { error_msg: string };
  };

  if (data.error) {
    throw new Error(`VK API error: ${data.error.error_msg}`);
  }

  const user = data.response?.[0];
  if (!user) {
    throw new Error('VK user not found');
  }

  return {
    vkId: BigInt(user.id),
    firstName: user.first_name,
    avatarUrl: user.photo_200,
  };
}

export async function upsertVkUser(data: VkUserData) {
  const existing = await db.query.users.findFirst({
    where: eq(users.vkId, data.vkId),
  });

  if (existing) {
    const [updated] = await db
      .update(users)
      .set({
        firstName: data.firstName,
        avatarUrl: data.avatarUrl ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.vkId, data.vkId))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(users)
    .values({
      vkId: data.vkId,
      firstName: data.firstName,
      avatarUrl: data.avatarUrl ?? null,
    })
    .returning();
  return created!;
}
