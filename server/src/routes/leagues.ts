import type { FastifyInstance } from 'fastify';
import {
  getOrCreateCurrentSeason,
  getSeasonNumber,
  getUserLeagueProgress,
  ensureUserSeasonStats,
  getUserSeasonStats,
  getUserPosition,
  getLeaderboard,
  getUnreadNotifications,
  markNotificationsRead,
  getUserSeasonHistory,
  saveDailySnapshot,
  getTodayStartSnapshot,
} from '../services/league-service.js';

export default async function leagueRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Получить текущий статус пользователя в лиге
  app.get('/api/leagues/me', async (request) => {
    const userId = request.user.id;
    const progress = await getUserLeagueProgress(userId);
    const season = await getOrCreateCurrentSeason();

    // Создаём запись в userSeasonStats при первом визите,
    // чтобы пользователь сразу отображался в leaderboard (с 0 LP)
    await ensureUserSeasonStats(userId, season.id);

    const [stats, position, seasonNumber] = await Promise.all([
      getUserSeasonStats(userId, season.id),
      getUserPosition(userId, season.id),
      getSeasonNumber(season.id),
    ]);

    // Сохраняем снепшот при первом обращении за день
    if (stats && position.position > 0) {
      const existingSnapshot = await getTodayStartSnapshot(userId, season.id);
      if (!existingSnapshot) {
        await saveDailySnapshot(userId, season.id, stats.leaguePoints, position.position);
      }
    }

    return {
      progress: {
        tier: progress.tier,
        division: 1, // legacy, всегда 1
      },
      stats: stats
        ? {
            leaguePoints: stats.leaguePoints,
            correctAnswers: stats.correctAnswers,
            quizzesCompleted: stats.quizzesCompleted,
            duelsWon: stats.duelsWon,
            streakBonus: stats.streakBonus,
          }
        : null,
      position,
      season: season
        ? {
            id: season.id,
            weekNumber: seasonNumber,
            year: season.year,
            startedAt: season.startedAt.toISOString(),
            endedAt: season.endedAt?.toISOString() ?? null,
            isActive: season.isActive,
          }
        : null,
    };
  });

  // Получить таблицу лидеров для группы пользователя
  app.get('/api/leagues/leaderboard', async (request) => {
    const userId = request.user.id;
    const progress = await getUserLeagueProgress(userId);
    const season = await getOrCreateCurrentSeason();

    const entries = await getLeaderboard(season.id, progress.tier, 50);

    return {
      entries: entries.map((e) => ({
        ...e,
        isCurrentUser: e.userId === userId,
      })),
    };
  });

  // Получить уведомления
  app.get('/api/leagues/notifications', async (request) => {
    const notifications = await getUnreadNotifications(request.user.id);

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        payload: n.payload,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  });

  // Пометить уведомления прочитанными
  app.post<{
    Body: { ids: number[] };
  }>('/api/leagues/notifications/read', async (request) => {
    await markNotificationsRead(request.user.id, request.body.ids);
    return { success: true };
  });

  // Получить историю сезонов
  app.get('/api/leagues/history', async (request) => {
    const history = await getUserSeasonHistory(request.user.id, 10);

    const seasonNumbers = await Promise.all(
      history.map((h) => getSeasonNumber(h.seasonId)),
    );

    return {
      history: history.map((h, i) => ({
        seasonId: h.seasonId,
        weekNumber: seasonNumbers[i],
        year: h.season.year,
        leaguePoints: h.leaguePoints,
        tierAtStart: h.tierAtStart,
        divisionAtStart: 1, // legacy
        tierAtEnd: h.tierAtEnd,
        divisionAtEnd: 1, // legacy
        divisionChange: h.divisionChange ?? 0,
      })),
    };
  });
}
