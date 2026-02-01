import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';

async function authPlugin(app: FastifyInstance) {
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

  await app.register(fastifyJwt, { secret });

  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: 'Не авторизован', code: 'UNAUTHORIZED' });
    }
  });
}

export default fp(authPlugin);
