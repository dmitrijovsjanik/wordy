import type { FastifyInstance } from 'fastify';
import { lookup } from '../services/dictionary-service.js';

export default async function dictionaryRoutes(app: FastifyInstance) {
  app.get('/api/dictionary/lookup', async (request, reply) => {
    const { text, lang } = request.query as { text?: string; lang?: string };

    if (!text || text.trim().length === 0) {
      return reply.status(400).send({ error: 'Введите слово', code: 'EMPTY_TEXT' });
    }

    if (text.trim().length > 100) {
      return reply.status(400).send({ error: 'Слишком длинный запрос', code: 'TEXT_TOO_LONG' });
    }

    try {
      const result = await lookup(text, lang);
      return result;
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Не удалось найти перевод', code: 'LOOKUP_FAILED' });
    }
  });
}
