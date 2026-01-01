import { FastifyInstance, FastifyPluginOptions } from 'fastify';

export default function webhookRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
  done: () => void,
) {
  app.post('/orders/paid', async (request, reply) => {
    // TODO: verify HMAC, persist idempotent record, enqueue job
    app.log.info('Received orders/paid webhook');
    reply.code(200).send({ ok: true });
  });

  done();
}
