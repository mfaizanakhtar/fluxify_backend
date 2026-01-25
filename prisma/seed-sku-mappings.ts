/**
 * Seed script to add SKU mappings for testing
 * Usage: npx ts-node prisma/seed-sku-mappings.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SKU mappings...\n');

  // Example SKU mappings using real FiRoam data
  // Format: providerSku should be "skuId:apiCode" (e.g., "26:392-0-3-1-G")
  // Get apiCode from firoam-data/firoam-packages-<countryCode>.csv
  const mappings = [
    {
      shopifySku: 'ESIM-JAPAN-1GB-3D',
      provider: 'firoam',
      providerSku: '26:392-0-3-1-G', // Japan 1GB / 3 days
      name: 'Japan 1GB eSIM',
      region: 'Asia',
      dataAmount: '1GB',
      validity: '3 days',
      isActive: true,
    },
    {
      shopifySku: 'ESIM-JAPAN-5GB-7D',
      provider: 'firoam',
      providerSku: '26:392-0-7-5-G', // Japan 5GB / 7 days
      name: 'Japan 5GB eSIM',
      region: 'Asia',
      dataAmount: '5GB',
      validity: '7 days',
      isActive: true,
    },
    {
      shopifySku: 'ESIM-USA-1GB-3D',
      provider: 'firoam',
      providerSku: '7:840-0-3-1-G', // USA 1GB / 3 days
      name: 'United States 1GB eSIM',
      region: 'North America',
      dataAmount: '1GB',
      validity: '3 days',
      isActive: true,
    },
    {
      shopifySku: 'ESIM-USA-10GB-30D',
      provider: 'firoam',
      providerSku: '7:840-0-30-10-G', // USA 10GB / 30 days
      name: 'United States 10GB eSIM',
      region: 'North America',
      dataAmount: '10GB',
      validity: '30 days',
      isActive: true,
    },
    {
      shopifySku: 'ESIM-MALAYSIA-1GB-3D',
      provider: 'firoam',
      providerSku: '13:458-0-3-1-G', // Malaysia 1GB / 3 days
      name: 'Malaysia 1GB eSIM',
      region: 'Asia',
      dataAmount: '1GB',
      validity: '3 days',
      isActive: true,
    },
  ];

  for (const mapping of mappings) {
    const result = await prisma.providerSkuMapping.upsert({
      where: { shopifySku: mapping.shopifySku },
      update: mapping,
      create: mapping,
    });
    console.log(`✅ ${result.shopifySku} → ${result.provider}:${result.providerSku}`);
  }

  console.log('\n✨ Seeding complete!');
  console.log('\nNext steps:');
  console.log('1. Update your Shopify product variant SKUs to match these:');
  mappings.forEach((m) => console.log(`   - ${m.shopifySku}`));
  console.log('2. Create a test order in Shopify');
  console.log('3. Watch your logs for provisioning!\n');
}

main()
  .catch((e) => {
    console.error('Error seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
