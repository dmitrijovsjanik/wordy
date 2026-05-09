import type { FastifyInstance } from 'fastify';
import { getNextPassage, checkAnswer } from '../services/reading/reading-service.js';
import { PILOT_FEATURES } from '../config/pilot-config.js';

export default async function readingRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_request, reply) => {
    if (!PILOT_FEATURES.reading) {
      return reply.code(404).send({ error: 'Not Found' });
    }
  });
  app.addHook('onRequest', app.authenticate);

  // ─── Get Next Passage ──────────────────────────────────────────────

  app.get<{
    Querystring: { level?: string };
  }>('/api/reading/next', async (request) => {
    const level = request.query.level || undefined;

    const result = getNextPassage(request.user.id, level);

    return {
      passage: result.passage,
      passageIndex: result.passageIndex,
    };
  });

  // ─── Check Answer ──────────────────────────────────────────────────

  app.post<{
    Body: { passageIndex: number; questionIndex: number; answerIndex: number; level?: string };
  }>('/api/reading/answer', async (request, reply) => {
    const { passageIndex, questionIndex, answerIndex, level } = request.body;

    if (
      typeof passageIndex !== 'number' ||
      typeof questionIndex !== 'number' ||
      typeof answerIndex !== 'number'
    ) {
      return reply.code(400).send({
        error: 'Неверные параметры',
        code: 'INVALID_PARAMS',
      });
    }

    return checkAnswer(passageIndex, questionIndex, answerIndex, level || undefined);
  });
}
