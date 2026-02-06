import crypto from 'node:crypto';
import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, friendRequests, friendships, inviteTokens, userLeagueProgress } from '../db/schema.js';

function generateFriendCode(): string {
  const bytes = crypto.randomBytes(12);
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += (bytes[i] % 10).toString();
  }
  return code;
}

export async function getOrCreateFriendCode(userId: number): Promise<string> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { friendCode: true },
  });

  if (!user) throw new Error('USER_NOT_FOUND');

  if (user.friendCode) return user.friendCode;

  // Генерируем код с повторами при коллизии
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateFriendCode();
    try {
      const [updated] = await db
        .update(users)
        .set({ friendCode: code, updatedAt: new Date() })
        .where(and(eq(users.id, userId), sql`${users.friendCode} IS NULL`))
        .returning({ friendCode: users.friendCode });

      if (updated?.friendCode) return updated.friendCode;

      // Кто-то другой уже установил код (параллельный запрос)
      const refreshed = await db.query.users.findFirst({
        where: eq(users.id, userId),
        columns: { friendCode: true },
      });
      if (refreshed?.friendCode) return refreshed.friendCode;
    } catch {
      // unique violation — повторяем с новым кодом
      continue;
    }
  }

  throw new Error('CODE_GENERATION_FAILED');
}

export async function getOrCreateInviteToken(userId: number): Promise<string> {
  const existing = await db.query.inviteTokens.findFirst({
    where: eq(inviteTokens.userId, userId),
    columns: { token: true },
  });

  if (existing) return existing.token;

  const token = crypto.randomUUID().replace(/-/g, '');

  await db.insert(inviteTokens).values({ userId, token }).onConflictDoNothing();

  // Если был конфликт (параллельный запрос), достаём существующий
  const result = await db.query.inviteTokens.findFirst({
    where: eq(inviteTokens.userId, userId),
    columns: { token: true },
  });

  if (!result) throw new Error('TOKEN_GENERATION_FAILED');
  return result.token;
}

async function createFriendship(userIdA: number, userIdB: number): Promise<void> {
  const [low, high] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
  await db.insert(friendships).values({ userId1: low, userId2: high }).onConflictDoNothing();
}

async function areFriends(userIdA: number, userIdB: number): Promise<boolean> {
  const [low, high] = userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA];
  const row = await db.query.friendships.findFirst({
    where: and(eq(friendships.userId1, low), eq(friendships.userId2, high)),
    columns: { id: true },
  });
  return !!row;
}

export async function sendFriendRequest(fromUserId: number, friendCode: string): Promise<{ requestId: number }> {
  // Найти пользователя по коду
  const target = await db.query.users.findFirst({
    where: eq(users.friendCode, friendCode),
    columns: { id: true },
  });

  if (!target) throw new Error('USER_NOT_FOUND');
  if (target.id === fromUserId) throw new Error('SELF_REQUEST');

  // Уже друзья?
  if (await areFriends(fromUserId, target.id)) {
    throw new Error('ALREADY_FRIENDS');
  }

  // Есть ли встречный pending запрос? → авто-принимаем
  const reverseRequest = await db.query.friendRequests.findFirst({
    where: and(
      eq(friendRequests.fromUserId, target.id),
      eq(friendRequests.toUserId, fromUserId),
      eq(friendRequests.status, 'pending'),
    ),
    columns: { id: true },
  });

  if (reverseRequest) {
    await db
      .update(friendRequests)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(friendRequests.id, reverseRequest.id));
    await createFriendship(fromUserId, target.id);
    return { requestId: reverseRequest.id };
  }

  // Есть ли уже pending запрос в эту сторону?
  const existingRequest = await db.query.friendRequests.findFirst({
    where: and(
      eq(friendRequests.fromUserId, fromUserId),
      eq(friendRequests.toUserId, target.id),
      eq(friendRequests.status, 'pending'),
    ),
    columns: { id: true },
  });

  if (existingRequest) throw new Error('REQUEST_EXISTS');

  // Создаём запрос
  const [request] = await db
    .insert(friendRequests)
    .values({ fromUserId, toUserId: target.id })
    .returning({ id: friendRequests.id });

  return { requestId: request.id };
}

export async function getIncomingRequests(userId: number) {
  const requests = await db.query.friendRequests.findMany({
    where: and(
      eq(friendRequests.toUserId, userId),
      eq(friendRequests.status, 'pending'),
    ),
    with: {
      fromUser: {
        columns: {
          id: true,
          firstName: true,
          username: true,
          avatarUrl: true,
          level: true,
        },
      },
    },
    orderBy: (fr, { desc }) => [desc(fr.createdAt)],
  });

  return requests.map((r) => ({
    id: r.id,
    fromUser: r.fromUser,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function acceptFriendRequest(userId: number, requestId: number): Promise<void> {
  const request = await db.query.friendRequests.findFirst({
    where: and(
      eq(friendRequests.id, requestId),
      eq(friendRequests.toUserId, userId),
      eq(friendRequests.status, 'pending'),
    ),
    columns: { id: true, fromUserId: true },
  });

  if (!request) throw new Error('REQUEST_NOT_FOUND');

  await db
    .update(friendRequests)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(eq(friendRequests.id, requestId));

  await createFriendship(userId, request.fromUserId);
}

export async function declineFriendRequest(userId: number, requestId: number): Promise<void> {
  const request = await db.query.friendRequests.findFirst({
    where: and(
      eq(friendRequests.id, requestId),
      eq(friendRequests.toUserId, userId),
      eq(friendRequests.status, 'pending'),
    ),
    columns: { id: true },
  });

  if (!request) throw new Error('REQUEST_NOT_FOUND');

  await db
    .update(friendRequests)
    .set({ status: 'declined', updatedAt: new Date() })
    .where(eq(friendRequests.id, requestId));
}

export async function acceptInviteToken(userId: number, token: string): Promise<{ friendId: number }> {
  const invite = await db.query.inviteTokens.findFirst({
    where: eq(inviteTokens.token, token),
    columns: { userId: true },
  });

  if (!invite) throw new Error('INVALID_TOKEN');
  if (invite.userId === userId) throw new Error('SELF_REQUEST');

  // Уже друзья — идемпотентно
  if (await areFriends(userId, invite.userId)) {
    return { friendId: invite.userId };
  }

  await createFriendship(userId, invite.userId);

  // Отменяем pending запросы между этими пользователями
  await db
    .update(friendRequests)
    .set({ status: 'accepted', updatedAt: new Date() })
    .where(
      and(
        eq(friendRequests.status, 'pending'),
        or(
          and(eq(friendRequests.fromUserId, userId), eq(friendRequests.toUserId, invite.userId)),
          and(eq(friendRequests.fromUserId, invite.userId), eq(friendRequests.toUserId, userId)),
        ),
      ),
    );

  return { friendId: invite.userId };
}

export async function getFriends(userId: number) {
  // Находим все дружбы где userId участвует
  const rows = await db
    .select({
      friendId: sql<number>`CASE WHEN ${friendships.userId1} = ${userId} THEN ${friendships.userId2} ELSE ${friendships.userId1} END`,
      friendSince: friendships.createdAt,
    })
    .from(friendships)
    .where(or(eq(friendships.userId1, userId), eq(friendships.userId2, userId)));

  if (rows.length === 0) return [];

  const friendIds = rows.map((r) => r.friendId);
  const friendSinceMap = new Map(rows.map((r) => [r.friendId, r.friendSince]));

  // Получаем данные пользователей
  const friendUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      username: users.username,
      avatarUrl: users.avatarUrl,
      level: users.level,
      streakDays: users.streakDays,
      leagueTier: userLeagueProgress.tier,
      leagueDivision: userLeagueProgress.division,
    })
    .from(users)
    .leftJoin(userLeagueProgress, eq(users.id, userLeagueProgress.userId))
    .where(sql`${users.id} IN (${sql.join(friendIds.map((id) => sql`${id}`), sql`, `)})`);

  return friendUsers.map((f) => ({
    id: f.id,
    firstName: f.firstName,
    username: f.username,
    avatarUrl: f.avatarUrl,
    level: f.level,
    streakDays: f.streakDays,
    league: f.leagueTier ? { tier: f.leagueTier, division: f.leagueDivision! } : null,
    friendSince: friendSinceMap.get(f.id)?.toISOString() ?? null,
  }));
}

export async function removeFriend(userId: number, friendId: number): Promise<void> {
  const [low, high] = userId < friendId ? [userId, friendId] : [friendId, userId];

  const result = await db
    .delete(friendships)
    .where(and(eq(friendships.userId1, low), eq(friendships.userId2, high)))
    .returning({ id: friendships.id });

  if (result.length === 0) throw new Error('FRIEND_NOT_FOUND');
}

export async function getPendingRequestCount(userId: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(friendRequests)
    .where(and(eq(friendRequests.toUserId, userId), eq(friendRequests.status, 'pending')));

  return result[0]?.count ?? 0;
}
