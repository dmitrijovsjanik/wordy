import type { FastifyInstance } from 'fastify';
import { createDuel, joinDuel, getDuel, finishDuel, startDuelQuiz } from '../services/duel-service.js';
import { PILOT_FEATURES } from '../config/pilot-config.js';

export default async function duelRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_request, reply) => {
    if (!PILOT_FEATURES.duels) {
      return reply.code(404).send({ error: 'Not Found' });
    }
  });
  app.addHook('onRequest', app.authenticate);

  app.post('/api/duels/create', async (request) => {
    const duel = await createDuel(request.user.id);
    return duel;
  });

  app.post<{ Params: { id: string } }>('/api/duels/:id/join', async (request) => {
    const duelId = Number(request.params.id);
    const duel = await joinDuel(duelId, request.user.id);
    return duel;
  });

  app.get<{ Params: { id: string } }>('/api/duels/:id', async (request) => {
    const duelId = Number(request.params.id);
    return getDuel(duelId);
  });

  app.post<{ Params: { id: string } }>('/api/duels/:id/start', async (request) => {
    const duelId = Number(request.params.id);
    return startDuelQuiz(duelId, request.user.id);
  });

  app.post<{ Params: { id: string } }>('/api/duels/:id/finish', async (request) => {
    const duelId = Number(request.params.id);
    return finishDuel(duelId);
  });
}
