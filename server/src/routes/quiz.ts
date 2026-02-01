import type { FastifyInstance } from 'fastify';
import {
  createSession,
  generateQuestion,
  recordAnswer,
  finishSession,
  getAnsweredMeaningIds,
} from '../services/quiz-service.js';

export default async function quizRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post('/api/quiz/start', async (request) => {
    const session = await createSession(request.user.id);
    const question = await generateQuestion();

    return { sessionId: session.id, question };
  });

  app.post<{
    Body: { sessionId: number; meaningId: number; selectedMeaningId: number | null; answerTimeMs: number };
  }>('/api/quiz/answer', async (request) => {
    const { sessionId, meaningId, selectedMeaningId, answerTimeMs } = request.body;

    const result = await recordAnswer(sessionId, meaningId, selectedMeaningId, answerTimeMs);

    let nextQuestion = null;
    if (!result.isFinished) {
      const excludeIds = await getAnsweredMeaningIds(sessionId);
      nextQuestion = await generateQuestion(excludeIds);
    }

    return { ...result, nextQuestion };
  });

  app.post<{ Body: { sessionId: number } }>('/api/quiz/finish', async (request) => {
    const { sessionId } = request.body;
    const result = await finishSession(sessionId, request.user.id);
    return result;
  });
}
