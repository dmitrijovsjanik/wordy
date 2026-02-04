import type { FastifyInstance } from 'fastify';
import { getProfile, getStats, updateLanguages, updateSettings } from '../services/user-service.js';

export default async function userRoutes(app: FastifyInstance) {
  app.addHook('onRequest', app.authenticate);

  app.get('/api/users/me', async (request) => {
    return getProfile(request.user.id);
  });

  app.get('/api/users/me/stats', async (request) => {
    return getStats(request.user.id);
  });

  app.put<{
    Body: { nativeLanguage: string; learningLanguage: string };
  }>('/api/users/me/languages', async (request) => {
    const { nativeLanguage, learningLanguage } = request.body;
    return updateLanguages(request.user.id, nativeLanguage, learningLanguage);
  });

  app.patch<{
    Body: { repeatMastered?: boolean };
  }>('/api/users/me/settings', async (request) => {
    return updateSettings(request.user.id, request.body);
  });
}
