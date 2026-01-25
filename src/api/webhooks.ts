import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { verifyShopifyWebhook } from '../shopify/webhooks';
import { getJobQueue } from '../queue/jobQueue.js';

const prisma = new PrismaClient();

interface ShopifyOrderPaidWebhook {
  id: number;
  name: string;
  email: string;
  line_items: Array<{
    id: number;
    variant_id: number;
    quantity: number;
    product_id: number;
    title: string;
  }>;
}

/**
 * Shopify webhook routes
 */
export async function shopifyWebhookRoutes(server: FastifyInstance) {
  /**
   * POST /webhooks/shopify/orders/paid
   * Handle order payment webhook from Shopify
   */
  server.post(
    '/webhooks/shopify/orders/paid',
    {
      config: {
        // Disable body parsing - we need raw body for HMAC verification
        rawBody: true,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Get raw body and HMAC header
        const rawBody = (request as unknown as { rawBody?: string }).rawBody;
        const hmacHeader = request.headers['x-shopify-hmac-sha256'] as string;
        const shopDomain = request.headers['x-shopify-shop-domain'] as string;

        if (!rawBody) {
          console.error('[Webhook] No raw body available');
          return reply.code(400).send({ error: 'Missing request body' });
        }

        if (!hmacHeader) {
          console.error('[Webhook] Missing HMAC header');
          return reply.code(401).send({ error: 'Missing HMAC signature' });
        }

        // Verify HMAC signature
        const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET!;
        const isValid = verifyShopifyWebhook(rawBody, hmacHeader, webhookSecret);

        if (!isValid) {
          console.error('[Webhook] Invalid HMAC signature');
          return reply.code(401).send({ error: 'Invalid signature' });
        }

        // Parse webhook payload
        const webhook: ShopifyOrderPaidWebhook = JSON.parse(rawBody);
        const orderId = webhook.id.toString();
        const orderName = webhook.name;
        const customerEmail = webhook.email;

        console.log(`[Webhook] Received orders/paid for ${orderName} (${orderId})`);

        // Process each line item
        for (const lineItem of webhook.line_items) {
          const lineItemId = lineItem.id.toString();
          const variantId = lineItem.variant_id.toString();

          // Check if already processed (idempotency)
          const existing = await prisma.esimDelivery.findFirst({
            where: {
              orderId,
              lineItemId,
            },
          });

          if (existing) {
            console.log(
              `[Webhook] Order ${orderName} line item ${lineItemId} already processed, skipping`,
            );
            continue;
          }

          // Create delivery record
          const delivery = await prisma.esimDelivery.create({
            data: {
              shop: shopDomain,
              orderId,
              orderName,
              lineItemId,
              variantId,
              customerEmail,
              status: 'pending',
            },
          });

          console.log(`[Webhook] Created delivery record ${delivery.id} for ${orderName}`);

          // Enqueue provisioning job
          const queue = getJobQueue();
          await queue.send('provision-esim', {
            deliveryId: delivery.id,
            orderId,
            orderName,
            lineItemId,
            variantId,
            customerEmail,
          });

          console.log(`[Webhook] Enqueued provisioning job for delivery ${delivery.id}`);
        }

        // Always return 200 quickly to avoid Shopify retries
        return reply.code(200).send({ received: true });
      } catch (error) {
        console.error('[Webhook] Error processing webhook:', error);

        // Still return 200 to avoid retries - log error for investigation
        return reply.code(200).send({ received: true, error: 'Processing error' });
      }
    },
  );

  /**
   * GET /webhooks/test
   * Test endpoint to verify webhook server is running
   */
  server.get('/webhooks/test', async (request, reply) => {
    return reply.send({ status: 'ok', message: 'Webhook server is running' });
  });
}
