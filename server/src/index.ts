import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quiz.js';
import userRoutes from './routes/users.js';
import duelRoutes from './routes/duels.js';
import collectionRoutes from './routes/collections.js';
import dictionaryRoutes from './routes/dictionary.js';
import leagueRoutes from './routes/leagues.js';
import friendRoutes from './routes/friends.js';
import botRoutes, { setupBot } from './routes/bot.js';
import { runStartupMigrations } from './db/startup-migrations.js';
import './cron/league-cron.js';

// Одноразовые миграции данных (выполняются до старта сервера)
await runStartupMigrations();

const isDev = process.env.NODE_ENV !== 'production';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: isDev ? 'http://localhost:5173' : false,
});

await app.register(authPlugin);

app.get('/api/health', async () => {
  return { status: 'ok' };
});

await app.register(authRoutes);
await app.register(quizRoutes);
await app.register(userRoutes);
await app.register(duelRoutes);
await app.register(collectionRoutes);
await app.register(dictionaryRoutes);
await app.register(leagueRoutes);
await app.register(friendRoutes);
await app.register(botRoutes);

const port = Number(process.env.PORT) || 3000;

await app.listen({ port, host: '0.0.0.0' });
console.log(`Server running on http://localhost:${port}`);

// Setup bot webhook and menu button after server starts
setupBot().catch((err) => console.error('Bot setup failed:', err));
