import type { FastifyInstance } from 'fastify';
import { getNextArticleQuestion, checkArticleAnswer } from '../services/grammar/article-service.js';
import { getNextTenseQuestion, checkTenseAnswer } from '../services/grammar/tense-quiz-service.js';
import { getNextCollocation, checkCollocationAnswer } from '../services/game/generators/collocation.js';
import { getNextFalseFriendQuestion, checkFalseFriendAnswer } from '../services/grammar/false-friends-service.js';
import { PILOT_FEATURES } from '../config/pilot-config.js';

export default async function grammarRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (_request, reply) => {
    if (!PILOT_FEATURES.grammar) {
      return reply.code(404).send({ error: 'Not Found' });
    }
  });
  app.addHook('onRequest', app.authenticate);

  // ─── Articles Quiz ───────────────────────────────────────────────

  app.get<{
    Querystring: { difficulty?: string };
  }>('/api/grammar/articles/next', async (request) => {
    const difficulty = request.query.difficulty
      ? Number(request.query.difficulty)
      : undefined;

    // Validate difficulty is 1, 2, or 3
    const validDifficulty =
      difficulty && [1, 2, 3].includes(difficulty) ? (difficulty as 1 | 2 | 3) : undefined;

    const result = getNextArticleQuestion(request.user.id, validDifficulty);

    return {
      exercise: result.exercise,
      exerciseIndex: result.exerciseIndex,
    };
  });

  app.post<{
    Body: { exerciseIndex: number; blankIndex: number; answer: string };
  }>('/api/grammar/articles/answer', async (request, reply) => {
    const { exerciseIndex, blankIndex, answer } = request.body;

    if (typeof exerciseIndex !== 'number' || typeof blankIndex !== 'number' || typeof answer !== 'string') {
      return reply.code(400).send({
        error: 'Неверные параметры',
        code: 'INVALID_PARAMS',
      });
    }

    return checkArticleAnswer(exerciseIndex, blankIndex, answer);
  });

  // ─── Tenses Quiz ────────────────────────────────────────────────

  app.get<{
    Querystring: { difficulty?: string };
  }>('/api/grammar/tenses/next', async (request) => {
    const difficulty = request.query.difficulty
      ? Number(request.query.difficulty)
      : undefined;

    const validDifficulty =
      difficulty && [1, 2, 3].includes(difficulty) ? (difficulty as 1 | 2 | 3) : undefined;

    const result = getNextTenseQuestion(request.user.id, validDifficulty);

    return {
      exercise: result.exercise,
      exerciseIndex: result.exerciseIndex,
    };
  });

  app.post<{
    Body: { exerciseIndex: number; answer: string };
  }>('/api/grammar/tenses/answer', async (request, reply) => {
    const { exerciseIndex, answer } = request.body;

    if (typeof exerciseIndex !== 'number' || typeof answer !== 'string') {
      return reply.code(400).send({
        error: 'Неверные параметры',
        code: 'INVALID_PARAMS',
      });
    }

    return checkTenseAnswer(exerciseIndex, answer);
  });

  // ─── Collocations Quiz ──────────────────────────────────────────

  app.get<{
    Querystring: { difficulty?: string };
  }>('/api/grammar/collocations/next', async (request) => {
    const difficulty = request.query.difficulty
      ? Number(request.query.difficulty)
      : undefined;

    const validDifficulty =
      difficulty && [1, 2, 3].includes(difficulty) ? difficulty : undefined;

    const result = getNextCollocation(validDifficulty);

    return {
      collocation: result.collocation,
      collocationIndex: result.collocationIndex,
    };
  });

  app.post<{
    Body: { collocationIndex: number; answer: string };
  }>('/api/grammar/collocations/answer', async (request, reply) => {
    const { collocationIndex, answer } = request.body;

    if (typeof collocationIndex !== 'number' || typeof answer !== 'string') {
      return reply.code(400).send({
        error: 'Неверные параметры',
        code: 'INVALID_PARAMS',
      });
    }

    return checkCollocationAnswer(collocationIndex, answer);
  });

  // ─── False Friends Quiz ──────────────────────────────────────────

  app.get('/api/grammar/false-friends/next', async (request) => {
    const result = getNextFalseFriendQuestion(request.user.id);
    return {
      question: result.question,
      questionIndex: result.questionIndex,
    };
  });

  app.post<{
    Body: { questionIndex: number; answer: string };
  }>('/api/grammar/false-friends/answer', async (request, reply) => {
    const { questionIndex, answer } = request.body;

    if (typeof questionIndex !== 'number' || typeof answer !== 'string') {
      return reply.code(400).send({
        error: 'Неверные параметры',
        code: 'INVALID_PARAMS',
      });
    }

    return checkFalseFriendAnswer(questionIndex, answer);
  });
}
