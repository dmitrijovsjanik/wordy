import type { FastifyInstance } from 'fastify';
import { startPlacement, answerPlacement, completePlacement, finalizePlacement, skipPlacement } from '../services/placement-service.js';
import { PLACEMENT_QUESTIONS_COUNT } from '../config/placement-config.js';

export default async function placementRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.post<{
    Body: { selfAssessment?: 'a1' | 'a2' | 'b1' | 'b2' };
  }>('/api/placement/start', async (request, reply) => {
    try {
      const { selfAssessment } = request.body ?? {};
      const result = await startPlacement(request.user.id, selfAssessment);
      if (!result) {
        return reply.code(500).send({ error: 'Не удалось создать тест', code: 'PLACEMENT_NO_WORDS' });
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      return reply.code(400).send({ error: message, code: 'PLACEMENT_START_ERROR' });
    }
  });

  app.post<{
    Body: { meaningId: number; selectedOption: string; answerTimeMs: number };
  }>('/api/placement/answer', async (request, reply) => {
    try {
      const { meaningId, selectedOption, answerTimeMs } = request.body;
      const result = await answerPlacement(request.user.id, meaningId, selectedOption, answerTimeMs);
      if (!result) {
        return reply.code(400).send({ error: 'Сессия не найдена', code: 'PLACEMENT_NO_SESSION' });
      }
      // Transform to client-expected format
      return {
        isCorrect: result.isCorrect,
        questionNumber: result.questionNumber ?? result.finished ? PLACEMENT_QUESTIONS_COUNT : 0,
        totalQuestions: result.totalQuestions ?? PLACEMENT_QUESTIONS_COUNT,
        nextQuestion: result.question ?? null,
        isFinished: result.finished,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      return reply.code(400).send({ error: message, code: 'PLACEMENT_ANSWER_ERROR' });
    }
  });

  app.post('/api/placement/complete', async (request, reply) => {
    try {
      const result = await completePlacement(request.user.id);
      if (!result) {
        return reply.code(400).send({ error: 'Сессия не найдена', code: 'PLACEMENT_NO_SESSION' });
      }
      // Transform to client-expected format
      return {
        cefr: result.resultCefr,
        estimatedVocabulary: result.estimatedVocabulary,
        percentile: result.percentile,
        subscribedCollections: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      return reply.code(500).send({ error: message, code: 'PLACEMENT_COMPLETE_ERROR' });
    }
  });

  app.post<{
    Body: { mode: 'all' | 'current-only' };
  }>('/api/placement/finalize', async (request, reply) => {
    try {
      const { mode } = request.body;
      await finalizePlacement(request.user.id, mode);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      return reply.code(400).send({ error: message, code: 'PLACEMENT_FINALIZE_ERROR' });
    }
  });

  app.post<{
    Body: { selectedCefr: 'a1' | 'a2' | 'b1' | 'b2' };
  }>('/api/placement/skip', async (request, reply) => {
    try {
      const { selectedCefr } = request.body;
      await skipPlacement(request.user.id, selectedCefr);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
      return reply.code(400).send({ error: message, code: 'PLACEMENT_SKIP_ERROR' });
    }
  });
}
