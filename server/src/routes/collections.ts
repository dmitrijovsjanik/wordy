import type { FastifyInstance } from 'fastify';
import {
  getMarketplace,
  getLibrary,
  getCollectionDetail,
  subscribe,
  unsubscribe,
  toggleActive,
  createUserCollection,
  updateUserCollection,
  deleteUserCollection,
  getErrorsCollection,
  getAllWords,
  addWordsToCollection,
  removeWordFromCollection,
} from '../services/collection-service.js';

export default async function collectionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/collections/marketplace', async (request) => {
    const groups = await getMarketplace(request.user.id);
    return { groups };
  });

  app.get('/api/collections/library', async (request) => {
    const items = await getLibrary(request.user.id);
    return { collections: items };
  });

  app.get('/api/collections/words', async (request) => {
    return getAllWords(request.user.id);
  });

  app.get('/api/collections/difficult', async (request) => {
    return getErrorsCollection(request.user.id);
  });

  // Алиас для коллекции ошибок
  app.get('/api/collections/errors', async (request) => {
    return getErrorsCollection(request.user.id);
  });

  app.get<{ Params: { id: string } }>('/api/collections/:id', async (request) => {
    const id = Number(request.params.id);
    const detail = await getCollectionDetail(id, request.user.id);
    if (!detail) {
      return { error: 'Коллекция не найдена', code: 'NOT_FOUND' };
    }
    return detail;
  });

  app.post<{ Body: { title: string; description?: string; words?: { wordText: string; translation: string; partOfSpeech?: string; contextExample?: string }[] } }>(
    '/api/collections',
    async (request, reply) => {
      try {
        const collectionId = await createUserCollection(request.user.id, request.body);
        return { collectionId };
      } catch (err) {
        if (err instanceof Error && err.message === 'COLLECTION_LIMIT_REACHED') {
          return reply.status(403).send({ error: 'Достигнут лимит коллекций', code: 'COLLECTION_LIMIT' });
        }
        throw err;
      }
    },
  );

  app.patch<{ Params: { id: string }; Body: { title?: string; description?: string; words?: { wordText: string; translation: string; partOfSpeech?: string; contextExample?: string }[] } }>(
    '/api/collections/:id',
    async (request) => {
      const id = Number(request.params.id);
      await updateUserCollection(request.user.id, id, request.body);
      return { success: true };
    },
  );

  app.delete<{ Params: { id: string } }>('/api/collections/:id', async (request) => {
    const id = Number(request.params.id);
    await deleteUserCollection(request.user.id, id);
    return { success: true };
  });

  // Add words to collection
  app.post<{
    Params: { id: string };
    Body: { meaningIds?: number[]; custom?: { wordText: string; translation: string; partOfSpeech?: string }[] };
  }>('/api/collections/:id/words', async (request, reply) => {
    const id = Number(request.params.id);
    try {
      const result = await addWordsToCollection(request.user.id, id, request.body);
      return { success: true, added: result.added };
    } catch (err) {
      if (err instanceof Error && err.message === 'WORD_LIMIT_REACHED') {
        return reply.status(403).send({ error: 'Достигнут лимит слов в коллекции', code: 'WORD_LIMIT' });
      }
      throw err;
    }
  });

  // Remove word from collection
  app.delete<{
    Params: { id: string; wordId: string };
    Querystring: { type?: string };
  }>('/api/collections/:id/words/:wordId', async (request) => {
    const id = Number(request.params.id);
    const wordId = Number(request.params.wordId);
    const type = (request.query.type === 'custom' ? 'custom' : 'meaning') as 'meaning' | 'custom';
    const result = await removeWordFromCollection(request.user.id, id, wordId, type);
    return { success: true, deleted: result.deleted };
  });

  app.post<{ Params: { id: string } }>('/api/collections/:id/subscribe', async (request) => {
    const id = Number(request.params.id);
    await subscribe(request.user.id, id);
    return { success: true };
  });

  app.delete<{ Params: { id: string } }>('/api/collections/:id/unsubscribe', async (request) => {
    const id = Number(request.params.id);
    await unsubscribe(request.user.id, id);
    return { success: true };
  });

  app.patch<{ Params: { id: string }; Body: { isActive: boolean } }>(
    '/api/collections/:id/toggle',
    async (request) => {
      const id = Number(request.params.id);
      await toggleActive(request.user.id, id, request.body.isActive);
      return { success: true };
    },
  );
}
