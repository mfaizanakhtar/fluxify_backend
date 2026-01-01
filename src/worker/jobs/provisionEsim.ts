import prisma from '../../db/prisma';
import FiRoamClient from '../../vendor/firoamClient';

const fiRoam = new FiRoamClient();

export async function handleProvision(jobData: Record<string, unknown>) {
  const deliveryId = String(jobData.deliveryId || jobData['deliveryId']);
  if (!deliveryId) throw new Error('missing deliveryId');

  const delivery = await prisma.esimDelivery.findUnique({ where: { id: deliveryId } });
  if (!delivery) throw new Error(`EsimDelivery ${deliveryId} not found`);

  if (delivery.status === 'delivered') {
    return { ok: true, reason: 'already delivered' };
  }

  await prisma.esimDelivery.update({ where: { id: deliveryId }, data: { status: 'provisioning' } });

  // Expect job to include an `orderPayload` matching FiRoam `addEsimOrder` fields
  const orderPayload = (jobData.orderPayload as Record<string, unknown>) || {};

  try {
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
    await prisma.esimDelivery.update({ where: { id: deliveryId }, data: { lastError: msg } });
    throw err;
  }
}
