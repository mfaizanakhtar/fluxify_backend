import prisma from '../../db/prisma';
import FiRoamClient from '../../vendor/firoamClient';
import { getShopifyClient } from '../../shopify/client';

const fiRoam = new FiRoamClient();

interface ProvisionJobData {
  deliveryId: string;
  orderId?: string;
  orderName?: string;
  lineItemId?: string;
  variantId?: string;
  customerEmail?: string;
  orderPayload?: Record<string, unknown>;
}

export async function handleProvision(jobData: Record<string, unknown>) {
  const data = jobData as unknown as ProvisionJobData;
  const deliveryId = String(data.deliveryId || '');
  if (!deliveryId) throw new Error('missing deliveryId');

  const delivery = await prisma.esimDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new Error(`EsimDelivery ${deliveryId} not found`);

  if (delivery.status === 'delivered') {
    return { ok: true, reason: 'already delivered' };
  }

  await prisma.esimDelivery.update({ where: { id: deliveryId }, data: { status: 'provisioning' } });

  console.log(`[ProvisionJob] Processing delivery ${deliveryId} for order ${delivery.orderName}`);

  try {
    let orderPayload = data.orderPayload;

    // If no orderPayload provided, fetch variant metafields from Shopify
    if (!orderPayload && delivery.variantId) {
      const shopify = getShopifyClient();
      const metafields = (await shopify.getVariantMetafields(delivery.variantId)) as Array<{
        namespace?: string;
        key?: string;
        value?: string;
      }>;

      const vendorPlanCode = metafields.find(
        (m) => m.namespace === 'vendor' && m.key === 'planCode',
      )?.value;

      if (!vendorPlanCode) {
        throw new Error(`Missing vendor.planCode metafield for variant ${delivery.variantId}`);
      }

      console.log(`[ProvisionJob] Using vendor plan: ${vendorPlanCode}`);

      orderPayload = {
        orderCode: delivery.orderName,
        packageCode: vendorPlanCode,
        quantity: 1,
      };
    }

    if (!orderPayload) {
      throw new Error('No order payload available');
    }

    const result = (await fiRoam.addEsimOrder(orderPayload)) as unknown;

    const obj = result as Record<string, unknown>;
    const encrypted = obj?.encrypted as Record<string, unknown> | undefined;
    if (encrypted) {
      const vendorReferenceId = encrypted.vendorReferenceId
        ? String(encrypted.vendorReferenceId)
        : undefined;
      const payloadEncrypted = encrypted.payloadEncrypted
        ? String(encrypted.payloadEncrypted)
        : undefined;

      await prisma.esimDelivery.update({
        where: { id: deliveryId },
        data: {
          vendorReferenceId,
          payloadEncrypted,
          status: 'delivered',
        },
      });

      console.log(`[ProvisionJob] eSIM provisioned successfully: ${vendorReferenceId}`);

      // TODO: Generate QR code
      // TODO: Send email
      // TODO: Create Shopify fulfillment

      return { ok: true };
    }

    // If no encrypted payload returned, store raw response
    await prisma.esimDelivery.update({
      where: { id: deliveryId },
      data: { lastError: JSON.stringify(result), status: 'failed' },
    });
    throw new Error('FiRoam returned unexpected response');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ProvisionJob] Failed:`, msg);
    await prisma.esimDelivery.update({
      where: { id: deliveryId },
      data: { lastError: msg, status: 'failed' },
    });
    throw err;
  }
}
