import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import learningRoutes from './routes/learning.js';
import userRoutes from './routes/users.js';
import collectionRoutes from './routes/collections.js';
import dictionaryRoutes from './routes/dictionary.js';
import leagueRoutes from './routes/leagues.js';
import friendRoutes from './routes/friends.js';
import botRoutes, { setupBot } from './routes/bot.js';
import vkBotRoutes from './routes/vk-bot.js';
import adminRoutes from './routes/admin.js';
import paymentRoutes from './routes/payments.js';
import ttsRoutes from './routes/tts.js';

import { runStartupMigrations } from './db/startup-migrations.js';
import './cron/league-cron.js';
import './cron/subscription-cron.js';

// Одноразовые миграции данных (выполняются до старта сервера)
await runStartupMigrations();

const isDev = process.env.NODE_ENV !== 'production';

// Pino-логгер: в dev-режиме только warn+ и отключённый request/response шум.
// Всю диагностику v2 пишем через console.log в собственном формате.
const app = Fastify({
  logger: isDev ? { level: 'warn' } : true,
  disableRequestLogging: isDev,
});

await app.register(cors, {
  origin: isDev ? ['http://localhost:5173', 'http://localhost:5174'] : false,
});

await app.register(authPlugin);

app.get('/api/health', async () => {
  return { status: 'ok' };
});

await app.register(authRoutes);
await app.register(learningRoutes);
await app.register(userRoutes);
await app.register(collectionRoutes);
await app.register(dictionaryRoutes);
await app.register(leagueRoutes);
await app.register(friendRoutes);
await app.register(botRoutes);
await app.register(vkBotRoutes);
await app.register(adminRoutes);
await app.register(paymentRoutes);
await app.register(ttsRoutes);

const port = Number(process.env.PORT) || 3000;

await app.listen({ port, host: '0.0.0.0' });
console.log(`Server running on http://localhost:${port}`);

// Setup bot webhook and menu button after server starts
setupBot().catch((err) => console.error('Bot setup failed:', err));
