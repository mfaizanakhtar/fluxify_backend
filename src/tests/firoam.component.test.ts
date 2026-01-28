import { describe, it, expect, beforeEach, vi } from 'vitest';
import nock from 'nock';
import FiRoamClient from '../vendor/firoamClient';

// Mock Prisma - must match the import path in firoamClient.ts
vi.mock('../db/prisma', () => ({
  default: {
    esimOrder: {
      create: vi.fn().mockResolvedValue({ id: 'mock-db-id' }),
    },
  },
}));

describe('FiRoamClient component test (mocked by default)', () => {
  const base = process.env.FIROAM_BASE_URL || 'https://bpm.roamwifi.hk';
  // signKey present in env; not used directly in the test

  beforeEach(() => {
    nock.cleanAll();
  });

  it('should login, place order and return canonical payload (mock)', async () => {
    // Ensure credentials are set for login flow (we mock network responses)
    process.env.FIROAM_PHONE = process.env.FIROAM_PHONE || 'mock-phone';
    process.env.FIROAM_PASSWORD = process.env.FIROAM_PASSWORD || 'mock-pass';
    // Mock login (uses GET per Python example in FiRoam docs)
    nock(base)
      .get('/api_order/login')
      .query(true)
      .reply(200, { code: 1, data: { token: 'mock-token' } });

    // Mock addEsimOrder -> returns orderNum
    nock(base)
      .post('/api_esim/addEsimOrder')
      .reply(200, { code: 0, data: { orderNum: 'EP-MOCK-1' } });

    // Mock getOrderInfo -> returns card info
    nock(base)
      .post('/api_esim/getOrderInfo')
      .reply(200, {
        code: 0,
        data: {
          cards: [{ lpa: 'lpa-mock', activation_code: 'ACT-MOCK', iccid: '8901000000000000001' }],
        },
      });

    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY || 'test-encryption-key-should-be-32-bytes!';

    const client = new FiRoamClient();
    const result = await client.addEsimOrder({
      skuId: '156',
      priceId: '100',
      count: '1',
      otherOrderId: 'external-1',
    });

    // Verify the raw response
    expect(result.raw).toBeDefined();
    expect(result.raw.code).toBe(0);
    expect((result.raw.data as Record<string, unknown>).orderNum).toBe('EP-MOCK-1');

    // Verify the canonical payload
    expect(result.canonical).toBeDefined();
    expect(result.canonical?.vendorId).toBe('EP-MOCK-1');
    expect(result.canonical?.lpa).toBe('lpa-mock');
    expect(result.canonical?.activationCode).toBe('ACT-MOCK');
    expect(result.canonical?.iccid).toBe('8901000000000000001');

    // Verify db record was created
    expect(result.db).toBeDefined();
    expect(result.db?.id).toBe('mock-db-id');
  });
});
