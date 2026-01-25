import prisma from '../../db/prisma';
import FiRoamClient from '../../vendor/firoamClient';

const fiRoam = new FiRoamClient();

interface ProvisionJobData {
  deliveryId: string;
  orderId?: string;
  orderName?: string;
  lineItemId?: string;
  variantId?: string;
  customerEmail?: string;
  sku?: string | null;
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

    // If no orderPayload provided, look up SKU mapping
    if (!orderPayload) {
      const sku = data.sku;

      if (!sku) {
        throw new Error('Missing SKU in job data');
      }

      // Look up provider mapping by SKU
      const mapping = await prisma.providerSkuMapping.findUnique({
        where: { shopifySku: sku },
      });

      if (!mapping) {
        throw new Error(`No provider mapping found for SKU: ${sku}`);
      }

      if (!mapping.isActive) {
        throw new Error(`SKU mapping is inactive: ${sku}`);
      }

      console.log(
        `[ProvisionJob] Using provider: ${mapping.provider}, SKU: ${mapping.providerSku}`,
      );

      // For now, we only support FiRoam
      if (mapping.provider !== 'firoam') {
        throw new Error(`Unsupported provider: ${mapping.provider}`);
      }

      // Parse the providerSku to extract skuId and priceId
      // Format: providerSku should be "skuId:priceId" (e.g., "26:392-1-1-300-M")
      // For backward compatibility, if no colon, treat as priceId only and fail with helpful error
      const parts = mapping.providerSku.split(':');
      if (parts.length !== 2) {
        throw new Error(
          `Invalid providerSku format: ${mapping.providerSku}. Expected format: "skuId:priceId" (e.g., "26:392-1-1-300-M")`,
        );
      }

      const [skuId, priceId] = parts;

      orderPayload = {
        skuId,
        priceId,
        count: '1',
        backInfo: '1', // Get full details immediately (one-step flow)
        customerEmail: delivery.customerEmail || undefined,
      };
    }

    if (!orderPayload) {
      throw new Error('No order payload available');
    }

    const result = await fiRoam.addEsimOrder(orderPayload);

    // Check if the order was successful
    if (!result.canonical || !result.db) {
      const errorMsg = result.error
        ? `FiRoam error: ${String(result.error)}`
        : 'FiRoam returned unexpected response';
      console.log(`[ProvisionJob] Failed: ${errorMsg}`);
      console.log('[ProvisionJob] Raw response:', JSON.stringify(result.raw, null, 2));
      throw new Error(errorMsg);
    }

    // Extract vendor order number from raw response
    const rawData = result.raw.data;
    const vendorOrderNum =
      typeof rawData === 'string' ? rawData : (rawData as Record<string, unknown>)?.orderNum;

    if (!vendorOrderNum) {
      throw new Error('No order number in FiRoam response');
    }

    console.log(`[ProvisionJob] FiRoam order created: ${vendorOrderNum}`);
    console.log(`[ProvisionJob] LPA: ${result.canonical.lpa || 'N/A'}`);
    console.log(`[ProvisionJob] Activation Code: ${result.canonical.activationCode || 'N/A'}`);
    console.log(`[ProvisionJob] ICCID: ${result.canonical.iccid || 'N/A'}`);

    // Encrypt the canonical payload for storage
    const crypto = await import('../../utils/crypto');
    const payloadEncrypted = await crypto.encrypt(JSON.stringify(result.canonical));

    await prisma.esimDelivery.update({
      where: { id: deliveryId },
      data: {
        vendorReferenceId: String(vendorOrderNum),
        payloadEncrypted,
        status: 'delivered',
      },
    });

    console.log(`[ProvisionJob] eSIM provisioned successfully: ${vendorOrderNum}`);

    // TODO: Generate QR code from result.canonical.lpa
    // TODO: Send email with QR code and activation instructions
    // TODO: Create Shopify fulfillment

    return { ok: true };
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
