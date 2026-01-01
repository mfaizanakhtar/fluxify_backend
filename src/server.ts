import Fastify from 'fastify';
import webhookRoutes from './api/webhook';

export default async function buildServer() {
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(webhookRoutes, { prefix: '/webhook' });

  return app;
}
