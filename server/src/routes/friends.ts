import type { FastifyInstance } from 'fastify';
import {
  getOrCreateFriendCode,
  getOrCreateInviteToken,
  sendFriendRequest,
  getIncomingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  acceptInviteToken,
  getFriends,
  removeFriend,
  getPendingRequestCount,
} from '../services/friend-service.js';

export default async function friendRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  // Список друзей
  app.get('/api/friends', async (request) => {
    const friends = await getFriends(request.user.id);
    return { friends };
  });

  // Мой код друга
  app.get('/api/friends/my-code', async (request) => {
    const friendCode = await getOrCreateFriendCode(request.user.id);
    return { friendCode };
  });

  // Инвайт-токен для ссылки
  app.get('/api/friends/invite-token', async (request) => {
    const token = await getOrCreateInviteToken(request.user.id);
    return { token };
  });

  // Входящие запросы
  app.get('/api/friends/requests', async (request) => {
    const [requests, count] = await Promise.all([
      getIncomingRequests(request.user.id),
      getPendingRequestCount(request.user.id),
    ]);
    return { requests, count };
  });

  // Отправить запрос по коду
  app.post<{ Body: { friendCode: string } }>('/api/friends/request', async (request, reply) => {
    try {
      const { friendCode } = request.body;
      const result = await sendFriendRequest(request.user.id, friendCode.replace(/\D/g, ''));
      return { success: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'USER_NOT_FOUND') {
        return reply.code(404).send({ error: 'Пользователь с таким кодом не найден', code: 'USER_NOT_FOUND' });
      }
      if (message === 'SELF_REQUEST') {
        return reply.code(400).send({ error: 'Нельзя добавить себя в друзья', code: 'SELF_REQUEST' });
      }
      if (message === 'ALREADY_FRIENDS') {
        return reply.code(400).send({ error: 'Вы уже друзья', code: 'ALREADY_FRIENDS' });
      }
      if (message === 'REQUEST_EXISTS') {
        return reply.code(400).send({ error: 'Запрос уже отправлен', code: 'REQUEST_EXISTS' });
      }
      throw error;
    }
  });

  // Принять запрос
  app.post<{ Params: { id: string } }>('/api/friends/requests/:id/accept', async (request, reply) => {
    try {
      await acceptFriendRequest(request.user.id, Number(request.params.id));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'REQUEST_NOT_FOUND') {
        return reply.code(404).send({ error: 'Запрос не найден', code: 'REQUEST_NOT_FOUND' });
      }
      throw error;
    }
  });

  // Отклонить запрос
  app.post<{ Params: { id: string } }>('/api/friends/requests/:id/decline', async (request, reply) => {
    try {
      await declineFriendRequest(request.user.id, Number(request.params.id));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'REQUEST_NOT_FOUND') {
        return reply.code(404).send({ error: 'Запрос не найден', code: 'REQUEST_NOT_FOUND' });
      }
      throw error;
    }
  });

  // Принять инвайт по токену (мгновенное добавление)
  app.post<{ Body: { token: string } }>('/api/friends/accept-invite', async (request, reply) => {
    try {
      const result = await acceptInviteToken(request.user.id, request.body.token);
      return { success: true, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'INVALID_TOKEN') {
        return reply.code(404).send({ error: 'Ссылка недействительна', code: 'INVALID_TOKEN' });
      }
      if (message === 'SELF_REQUEST') {
        return reply.code(400).send({ error: 'Нельзя добавить себя в друзья', code: 'SELF_REQUEST' });
      }
      throw error;
    }
  });

  // Удалить друга
  app.delete<{ Params: { friendId: string } }>('/api/friends/:friendId', async (request, reply) => {
    try {
      await removeFriend(request.user.id, Number(request.params.friendId));
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'FRIEND_NOT_FOUND') {
        return reply.code(404).send({ error: 'Друг не найден', code: 'FRIEND_NOT_FOUND' });
      }
      throw error;
    }
  });
}
