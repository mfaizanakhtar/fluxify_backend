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

      // Parse the providerSku to extract skuId, apiCode, and priceId
      // Format: "skuId:apiCode:priceId" (e.g., "120:826-0-?-1-G-D:14094")
      // Legacy format: "skuId:apiCode" without priceId (will require runtime lookup for daypass)
      const parts = mapping.providerSku.split(':');
      if (parts.length < 2) {
        throw new Error(
          `Invalid providerSku format: ${mapping.providerSku}. Expected format: "skuId:apiCode:priceId" (e.g., "120:826-0-?-1-G-D:14094")`,
        );
      }

      // Handle both formats:
      // New: "120:826-0-?-1-G-D:14094" (skuId:apiCode:priceId)
      // Legacy: "120:826-0-?-1-G-D" (skuId:apiCode) - requires runtime lookup for daypass
      const skuId = parts[0];
      const apiCode = parts.length >= 2 ? parts[1] : '';
      const storedPriceId = parts.length >= 3 ? parts[2] : null;

      orderPayload = {
        skuId,
        count: '1',
        backInfo: '1', // Get full details immediately (one-step flow)
        customerEmail: delivery.customerEmail || undefined,
      };

      // Add daypassDays parameter for daypass packages
      if (mapping.packageType === 'daypass') {
        if (!mapping.daysCount) {
          throw new Error(`Daypass package ${sku} requires daysCount field in mapping`);
        }

        // For daypass, the apiCode template has "?" which gets replaced with actual days
        const apiCodeWithDays = apiCode.replace('?', String(mapping.daysCount));

        // Use stored priceId if available (new format), otherwise do runtime lookup (legacy)
        if (storedPriceId) {
          console.log(
            `[ProvisionJob] Daypass: ${mapping.daysCount} days, using stored priceId: ${storedPriceId}`,
          );
          orderPayload.priceId = storedPriceId;
        } else {
          // Legacy format: Need to fetch the numeric priceid from FiRoam API
          console.log(
            `[ProvisionJob] Daypass: ${mapping.daysCount} days, looking up priceid for apiCode: ${apiCodeWithDays}`,
          );

          // Fetch packages from FiRoam to get the numeric priceid
          const packagesResult = await fiRoam.getPackages(skuId);
          if (!packagesResult.packageData) {
            throw new Error(
              `Failed to fetch packages for skuId ${skuId}: ${packagesResult.error || 'Unknown error'}`,
            );
          }

          // Find the package matching our apiCode
          const esimPackages = packagesResult.packageData.esimPackageDtoList || [];
          const matchingPkg = esimPackages.find((pkg) => pkg.apiCode === apiCodeWithDays);

          if (!matchingPkg) {
            // Try without the day replacement (some daypass packages might use different format)
            const matchingPkgAlt = esimPackages.find(
              (pkg) =>
                pkg.supportDaypass === 1 &&
                pkg.flows === parseInt(apiCode.split('-')[3] || '0', 10),
            );
            if (!matchingPkgAlt) {
              console.log(
                `[ProvisionJob] Available packages:`,
                esimPackages.map((p) => ({
                  apiCode: p.apiCode,
                  priceid: p.priceid,
                  supportDaypass: p.supportDaypass,
                })),
              );
              throw new Error(`No matching daypass package found for apiCode: ${apiCodeWithDays}`);
            }
            orderPayload.priceId = String(matchingPkgAlt.priceid);
            console.log(
              `[ProvisionJob] Found daypass package by data amount, priceid: ${matchingPkgAlt.priceid}`,
            );
          } else {
            orderPayload.priceId = String(matchingPkg.priceid);
            console.log(`[ProvisionJob] Found daypass package, priceid: ${matchingPkg.priceid}`);
          }
        }

        (orderPayload as Record<string, unknown>).daypassDays = String(mapping.daysCount);
      } else {
        // Fixed package: Use stored priceId if available, otherwise use apiCode as priceId (legacy behavior)
        if (storedPriceId) {
          orderPayload.priceId = storedPriceId;
        } else {
          // Legacy: apiCode might be numeric priceId
          orderPayload.priceId = apiCode;
        }
      }
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
