import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  quizSessions,
  userWordProgressWord,
  userCustomWords,
  userCustomWordProgress,
  userCollections,
  friendships,
  friendRequests,
  streakActivityDays,
  userLeagueProgress,
  userSeasonStats,
  leagueNotifications,
  inviteTokens,
  payments,
} from '../db/schema.js';

/**
 * Объединяет аккаунт sourceUser в targetUser.
 * Переносит все данные sourceUser → targetUser и удаляет sourceUser.
 * Всё в одной транзакции.
 */
export async function mergeAccounts(targetUserId: number, sourceUserId: number): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. Перенести прогресс. Если в target уже есть запись для того же word_id —
    // удаляем из source (target имеет приоритет: вероятно бОльший прогресс).
    await tx.execute(sql`
      DELETE FROM user_word_progress_word
      WHERE user_id = ${sourceUserId}
        AND word_id IN (
          SELECT word_id FROM user_word_progress_word WHERE user_id = ${targetUserId}
        )
    `);
    await tx.update(userWordProgressWord)
      .set({ userId: targetUserId })
      .where(eq(userWordProgressWord.userId, sourceUserId));

    // 2. Custom words progress — аналогично
    await tx.execute(sql`
      DELETE FROM user_custom_word_progress
      WHERE user_id = ${sourceUserId}
        AND custom_word_id IN (
          SELECT custom_word_id FROM user_custom_word_progress WHERE user_id = ${targetUserId}
        )
    `);
    await tx.update(userCustomWordProgress)
      .set({ userId: targetUserId })
      .where(eq(userCustomWordProgress.userId, sourceUserId));

    // 3. Custom words
    await tx.update(userCustomWords)
      .set({ userId: targetUserId })
      .where(eq(userCustomWords.userId, sourceUserId));

    // 4. Quiz sessions
    await tx.update(quizSessions)
      .set({ userId: targetUserId })
      .where(eq(quizSessions.userId, sourceUserId));

    // 5. Collections — дедупликация
    await tx.execute(sql`
      DELETE FROM user_collections
      WHERE user_id = ${sourceUserId}
        AND collection_id IN (
          SELECT collection_id FROM user_collections WHERE user_id = ${targetUserId}
        )
    `);
    await tx.update(userCollections)
      .set({ userId: targetUserId })
      .where(eq(userCollections.userId, sourceUserId));

    // 6. Friendships — перенос с проверкой дубликатов
    // Обновляем userId1
    await tx.execute(sql`
      UPDATE friendships SET user_id_1 = ${targetUserId}
      WHERE user_id_1 = ${sourceUserId}
        AND NOT EXISTS (
          SELECT 1 FROM friendships f2
          WHERE f2.user_id_1 = ${targetUserId} AND f2.user_id_2 = friendships.user_id_2
        )
    `);
    // Обновляем userId2
    await tx.execute(sql`
      UPDATE friendships SET user_id_2 = ${targetUserId}
      WHERE user_id_2 = ${sourceUserId}
        AND NOT EXISTS (
          SELECT 1 FROM friendships f2
          WHERE f2.user_id_1 = friendships.user_id_1 AND f2.user_id_2 = ${targetUserId}
        )
    `);
    // Удаляем оставшиеся (дубликаты)
    await tx.delete(friendships)
      .where(eq(friendships.userId1, sourceUserId));
    await tx.delete(friendships)
      .where(eq(friendships.userId2, sourceUserId));

    // 7. Friend requests
    await tx.delete(friendRequests)
      .where(eq(friendRequests.fromUserId, sourceUserId));
    await tx.delete(friendRequests)
      .where(eq(friendRequests.toUserId, sourceUserId));

    // 8. Streak activity days — дедупликация по дате
    await tx.execute(sql`
      DELETE FROM streak_activity_days
      WHERE user_id = ${sourceUserId}
        AND date IN (
          SELECT date FROM streak_activity_days WHERE user_id = ${targetUserId}
        )
    `);
    await tx.update(streakActivityDays)
      .set({ userId: targetUserId })
      .where(eq(streakActivityDays.userId, sourceUserId));

    // 9. League progress — оставляем target, удаляем source
    await tx.delete(userLeagueProgress)
      .where(eq(userLeagueProgress.userId, sourceUserId));

    // 10. Season stats — дедупликация по seasonId
    await tx.execute(sql`
      DELETE FROM user_season_stats
      WHERE user_id = ${sourceUserId}
        AND season_id IN (
          SELECT season_id FROM user_season_stats WHERE user_id = ${targetUserId}
        )
    `);
    await tx.update(userSeasonStats)
      .set({ userId: targetUserId })
      .where(eq(userSeasonStats.userId, sourceUserId));

    // 11. Daily league snapshots
    await tx.execute(sql`
      DELETE FROM daily_league_snapshots
      WHERE user_id = ${sourceUserId}
    `);

    // 12. League notifications
    await tx.update(leagueNotifications)
      .set({ userId: targetUserId })
      .where(eq(leagueNotifications.userId, sourceUserId));

    // 13. Payments
    await tx.update(payments)
      .set({ userId: targetUserId })
      .where(eq(payments.userId, sourceUserId));

    // 14. Invite tokens
    await tx.delete(inviteTokens)
      .where(eq(inviteTokens.userId, sourceUserId));

    // 16. Duels — перенести
    await tx.execute(sql`
      UPDATE duels SET challenger_id = ${targetUserId}
      WHERE challenger_id = ${sourceUserId}
    `);
    await tx.execute(sql`
      UPDATE duels SET opponent_id = ${targetUserId}
      WHERE opponent_id = ${sourceUserId}
    `);
    await tx.execute(sql`
      UPDATE duels SET winner_id = ${targetUserId}
      WHERE winner_id = ${sourceUserId}
    `);

    // 17. Объединить статистику пользователей
    const [sourceUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, sourceUserId));
    const [targetUser] = await tx
      .select()
      .from(users)
      .where(eq(users.id, targetUserId));

    if (sourceUser && targetUser) {
      await tx.update(users)
        .set({
          xp: Math.max(targetUser.xp, sourceUser.xp),
          level: Math.max(targetUser.level, sourceUser.level),
          gems: targetUser.gems + sourceUser.gems,
          streakDays: Math.max(targetUser.streakDays, sourceUser.streakDays),
          maxStreakDays: Math.max(targetUser.maxStreakDays, sourceUser.maxStreakDays),
          bestAnswerStreak: Math.max(targetUser.bestAnswerStreak, sourceUser.bestAnswerStreak),
          streakFreezes: targetUser.streakFreezes + sourceUser.streakFreezes,
          // Premium — берём дальнюю дату
          premiumUntil: targetUser.premiumUntil && sourceUser.premiumUntil
            ? (targetUser.premiumUntil > sourceUser.premiumUntil ? targetUser.premiumUntil : sourceUser.premiumUntil)
            : targetUser.premiumUntil ?? sourceUser.premiumUntil,
          updatedAt: new Date(),
        })
        .where(eq(users.id, targetUserId));
    }

    // 18. Удалить source user
    await tx.delete(users).where(eq(users.id, sourceUserId));
  });
}
