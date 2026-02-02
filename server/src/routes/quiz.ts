import type { FastifyInstance } from 'fastify';
import {
  createSession,
  generateQuestion,
  recordAnswer,
  finishSession,
  getAnsweredMeaningIds,
  generateQuestionFromPool,
  recordInfiniteAnswer,
} from '../services/quiz-service.js';
import type { LanguagePair } from '../types/language.js';

export default async function quizRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post<{ Querystring: { lang?: string } }>('/api/quiz/start', async (request) => {
    const lang = (request.query.lang ?? 'en-ru') as LanguagePair;
    const session = await createSession(request.user.id);
    const question = await generateQuestion([], lang);

    return { sessionId: session.id, question };
  });

  app.post<{
    Body: { sessionId: number; meaningId: number; selectedMeaningId: number | null; answerTimeMs: number };
    Querystring: { lang?: string };
  }>('/api/quiz/answer', async (request) => {
    const { sessionId, meaningId, selectedMeaningId, answerTimeMs } = request.body;
    const lang = (request.query.lang ?? 'en-ru') as LanguagePair;

    const result = await recordAnswer(sessionId, meaningId, selectedMeaningId, answerTimeMs);

    let nextQuestion = null;
    if (!result.isFinished) {
      const excludeIds = await getAnsweredMeaningIds(sessionId);
      nextQuestion = await generateQuestion(excludeIds, lang);
    }

    return { ...result, nextQuestion };
  });

  app.post<{ Body: { sessionId: number } }>('/api/quiz/finish', async (request) => {
    const { sessionId } = request.body;
    const result = await finishSession(sessionId, request.user.id);
    return result;
  });

  // ─── Infinite Quiz ──────────────────────────────────────────────────────

  app.get<{ Querystring: { exclude?: string; lang?: string; collectionId?: string } }>('/api/quiz/next', async (request) => {
    const excludeStr = request.query.exclude ?? '';
    const excludeIds = excludeStr
      ? excludeStr.split(',').map(Number).filter((n) => !Number.isNaN(n))
      : [];
    const lang = (request.query.lang ?? 'en-ru') as LanguagePair;
    const collectionId = request.query.collectionId ? Number(request.query.collectionId) : undefined;

    const question = await generateQuestionFromPool(request.user.id, excludeIds, lang, collectionId);
    return { question };
  });

  app.post<{
    Body: { meaningId: number; selectedMeaningId: number | null };
  }>('/api/quiz/answer-infinite', async (request) => {
    const { meaningId, selectedMeaningId } = request.body;
    const result = await recordInfiniteAnswer(
      request.user.id,
      meaningId,
      selectedMeaningId,
    );
    return result;
  });
}
