import Fastify from 'fastify';
import webhookRoutes from './api/webhook';
import usageRoutes from './api/usage';
import { getShopifyClient } from './shopify/client';

export default async function buildServer() {
  const app = Fastify({
    logger: true,
    // Enable raw body for webhook HMAC verification
    bodyLimit: 1048576, // 1MB
  });

  // Add raw body parser for webhooks
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    // Store raw body for HMAC verification
    (req as unknown as { rawBody: string }).rawBody = body as string;
    try {
      const json = JSON.parse(body as string);
      done(null, json);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Initialize Shopify client
  try {
    const shopify = getShopifyClient();
    await shopify.initialize();
    app.log.info('[Server] Shopify client initialized');
  } catch (error) {
    const err = error as Error;
    app.log.error({ err }, '[Server] Failed to initialize Shopify client');
  }

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(webhookRoutes, { prefix: '/webhook' });
  app.register(usageRoutes);

  return app;
}
