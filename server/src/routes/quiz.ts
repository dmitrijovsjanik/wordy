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
  recordGrammarAnswer,
} from '../services/quiz-service.js';
import type { LanguagePair, GeneratorType } from '../services/game/types.js';
import type { GrammarType } from '../services/game/generators/grammar.js';
import { ERRORS_COLLECTION_ID } from '../config/errors-config.js';
import { getAiHints } from '../services/ai-content-service.js';

const VALID_GENERATORS = new Set<string>(['en-ru', 'ru-en', 'spelling', 'match-pairs', 'cloze', 'listening', 'dictation', 'free-recall', 'grammar-article', 'grammar-tense', 'grammar-collocation', 'grammar-false-friend', 'grammar-tense-match']);

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

  app.get<{ Querystring: { exclude?: string; lang?: string; collectionId?: string; type?: string; generators?: string; recentCorrect?: string; recentTotal?: string; questionIndex?: string } }>('/api/quiz/next', async (request) => {
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

    // Adaptive difficulty params
    const recentCorrect = Number(request.query.recentCorrect) || 0;
    const recentTotal = Number(request.query.recentTotal) || 0;
    const questionIndex = Number(request.query.questionIndex) || 0;

    const question = await generateQuestionFromPool(
      request.user.id,
      excludeIds,
      lang,
      collectionId,
      fixedDirection,
      questionType as 'spelling' | 'match-pairs' | 'cloze' | 'listening' | 'dictation' | 'free-recall' | undefined,
      recentGenerators,
      recentCorrect,
      recentTotal,
      questionIndex,
    );
    return { question };
  });

  app.post<{
    Body: { meaningId: number; selectedMeaningId: number | null; streak?: number; doubleXpClaimed?: boolean; skip?: boolean };
  }>('/api/quiz/answer-infinite', async (request) => {
    const { meaningId, selectedMeaningId, streak = 0, doubleXpClaimed = false, skip = false } = request.body;
    const result = await recordInfiniteAnswer(
      request.user.id,
      meaningId,
      selectedMeaningId,
      streak,
      doubleXpClaimed,
      skip,
    );
    return result;
  });

  // ─── Grammar Answer ────────────────────────────────────────────────────

  app.post<{
    Body: {
      grammarType: GrammarType;
      answer: string;
      exerciseIndex?: number;
      blankIndex?: number;
      collocationIndex?: number;
      questionIndex?: number;
      streak?: number;
      skip?: boolean;
    };
  }>('/api/quiz/answer-grammar', async (request) => {
    const { grammarType, answer, exerciseIndex, blankIndex, collocationIndex, questionIndex, streak = 0, skip = false } = request.body;
    const result = await recordGrammarAnswer(
      request.user.id,
      grammarType,
      { exerciseIndex, blankIndex, collocationIndex, questionIndex, answer },
      streak,
      skip,
    );
    return result;
  });

  // ─── Hints ──────────────────────────────────────────────────────────────

  app.get<{ Querystring: { meaningId: string; level: string } }>(
    '/api/quiz/hint',
    async (request) => {
      const meaningId = Number(request.query.meaningId);
      const level = Number(request.query.level);
      if (!meaningId || !level) return { hint: null, hasMore: false };
      const hints = await getAiHints(meaningId);
      if (!hints) return { hint: null, hasMore: false };
      const hint = hints.hints.find(h => h.level === level);
      return { hint: hint?.text ?? null, hasMore: level < hints.hints.length };
    },
  );

  // ─── Match-Pairs Answer ─────────────────────────────────────────────────

  app.post<{
    Body: { results: Array<{ meaningId: number; isCorrect: boolean }>; streak?: number; doubleXpClaimed?: boolean };
  }>('/api/quiz/answer-match-pairs', async (request) => {
    const { results, streak = 0, doubleXpClaimed = false } = request.body;
    const result = await recordMatchPairsAnswer(
      request.user.id,
      results,
      streak,
      doubleXpClaimed,
    );
    return result;
  });
}
