import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import quizRoutes from './routes/quiz.js';
import userRoutes from './routes/users.js';
import duelRoutes from './routes/duels.js';
import collectionRoutes from './routes/collections.js';
import dictionaryRoutes from './routes/dictionary.js';

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

const port = Number(process.env.PORT) || 3000;

await app.listen({ port, host: '0.0.0.0' });
console.log(`Server running on http://localhost:${port}`);
