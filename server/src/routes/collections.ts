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
  getDifficultWords,
  getAllWords,
} from '../services/collection-service.js';

export default async function collectionRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/collections/marketplace', async (request) => {
    const items = await getMarketplace(request.user.id);
    return { collections: items };
  });

  app.get('/api/collections/library', async (request) => {
    const items = await getLibrary(request.user.id);
    return { collections: items };
  });

  app.get('/api/collections/words', async (request) => {
    return getAllWords(request.user.id);
  });

  app.get('/api/collections/difficult', async (request) => {
    return getDifficultWords(request.user.id);
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
    async (request) => {
      const collectionId = await createUserCollection(request.user.id, request.body);
      return { collectionId };
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
