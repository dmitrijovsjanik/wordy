import type { FastifyInstance } from 'fastify';
import {
  createSession,
  generateQuestion,
  recordAnswer,
  finishSession,
  getAnsweredMeaningIds,
  generateQuestionFromPool,
  recordInfiniteAnswer,
  recordMatchPairsAnswer,
} from '../services/quiz-service.js';
import type { LanguagePair, GeneratorType } from '../services/game/types.js';
import { ERRORS_COLLECTION_ID } from '../config/errors-config.js';

const VALID_GENERATORS = new Set<string>(['en-ru', 'ru-en', 'spelling', 'match-pairs']);

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

  app.get<{ Querystring: { exclude?: string; lang?: string; collectionId?: string; type?: string; generators?: string } }>('/api/quiz/next', async (request) => {
    const excludeStr = request.query.exclude ?? '';
    const excludeIds = excludeStr
      ? excludeStr.split(',').map(Number).filter((n) => !Number.isNaN(n))
      : [];
    const langParam = request.query.lang;
    const questionType = request.query.type; // 'spelling' или undefined

    // Если lang указан явно — используем как fixed direction, иначе auto (random)
    const fixedDirection = langParam ? (langParam as LanguagePair) : undefined;
    const lang = (langParam ?? 'en-ru') as LanguagePair;

    // Поддержка collectionId='errors' для коллекции ошибок
    const rawCollectionId = request.query.collectionId;
    const collectionId = rawCollectionId === ERRORS_COLLECTION_ID
      ? ERRORS_COLLECTION_ID
      : rawCollectionId ? Number(rawCollectionId) : undefined;

    // История недавних генераторов для авто-ротации
    const generatorsStr = request.query.generators ?? '';
    const recentGenerators = generatorsStr
      ? generatorsStr.split(',').filter((g): g is GeneratorType => VALID_GENERATORS.has(g))
      : [];

    const question = await generateQuestionFromPool(
      request.user.id,
      excludeIds,
      lang,
      collectionId,
      fixedDirection,
      questionType as 'spelling' | 'match-pairs' | undefined,
      recentGenerators,
    );
    return { question };
  });

  app.post<{
    Body: { meaningId: number; selectedMeaningId: number | null; streak?: number };
  }>('/api/quiz/answer-infinite', async (request) => {
    const { meaningId, selectedMeaningId, streak = 0 } = request.body;
    const result = await recordInfiniteAnswer(
      request.user.id,
      meaningId,
      selectedMeaningId,
      streak,
    );
    return result;
  });

  // ─── Match-Pairs Answer ─────────────────────────────────────────────────

  app.post<{
    Body: { results: Array<{ meaningId: number; isCorrect: boolean }>; streak?: number };
  }>('/api/quiz/answer-match-pairs', async (request) => {
    const { results, streak = 0 } = request.body;
    const result = await recordMatchPairsAnswer(
      request.user.id,
      results,
      streak,
    );
    return result;
  });
}
