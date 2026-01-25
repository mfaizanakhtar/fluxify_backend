/**
 * Clean Shopify Export - Remove Unfulfillable Products
 *
 * Removes products from export that cannot be fulfilled:
 * - Daypass not supported
 * - Data amount not offered
 * - Days count not offered
 * - Country not in FiRoam
 *
 * Usage: npm run clean:export
 */
import fs from 'fs';
import path from 'path';

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function main() {
  console.log('🧹 Clean Shopify Export - Remove Unfulfillable Products\n');

  // Load mappings to determine which SKUs to keep
  const mappingsFile = path.join(process.cwd(), 'shopify-firoam-mappings.csv');
  if (!fs.existsSync(mappingsFile)) {
    throw new Error(`File not found: ${mappingsFile}. Run 'npm run match:firoam' first.`);
  }

  console.log('📦 Loading FiRoam mappings...');
  const mappingsContent = fs.readFileSync(mappingsFile, 'utf-8');
  const mappingsLines = mappingsContent.split('\n').filter((l) => l.trim());

  // Build set of SKUs that should be kept (MATCHED status)
  const keepSkus = new Set<string>();
  const removeReasons = new Map<string, string>();

  for (let i = 1; i < mappingsLines.length; i++) {
    const fields = parseCSVLine(mappingsLines[i]);
    const sku = fields[0];
    const matchStatus = fields[11];

    if (matchStatus === 'MATCHED') {
      keepSkus.add(sku);
    } else {
      removeReasons.set(sku, matchStatus);
    }
  }

  console.log(`  Keep: ${keepSkus.size} SKUs`);
  console.log(`  Remove: ${removeReasons.size} SKUs\n`);

  // Load updated export
  const exportFile = path.join(process.cwd(), 'products_export_updated.csv');
  if (!fs.existsSync(exportFile)) {
    throw new Error(`File not found: ${exportFile}. Run 'npm run update:export' first.`);
  }

  console.log('📦 Loading Shopify export...');
  const exportContent = fs.readFileSync(exportFile, 'utf-8');
  const exportLines = exportContent.split('\n');

  console.log(`  Found ${exportLines.length - 1} rows\n`);

  // Filter lines
  console.log('✂️  Filtering products...');
  const outputLines: string[] = [];
  let kept = 0;
  let removed = 0;
  const removalStats: Record<string, number> = {};

  for (let i = 0; i < exportLines.length; i++) {
    const line = exportLines[i];

    if (!line.trim()) continue;

    // Keep header
    if (i === 0) {
      outputLines.push(line);
      continue;
    }

    const fields = parseCSVLine(line);
    const variantSku = fields[17]; // Variant SKU column

    if (!variantSku || !variantSku.trim()) {
      removed++;
      removalStats['No SKU'] = (removalStats['No SKU'] || 0) + 1;
      continue;
    }

    if (keepSkus.has(variantSku)) {
      outputLines.push(line);
      kept++;
    } else {
      const reason = removeReasons.get(variantSku) || 'Unknown';
      removalStats[reason] = (removalStats[reason] || 0) + 1;
      removed++;
    }
  }

  // Write cleaned export
  const cleanedFile = path.join(process.cwd(), 'products_export_cleaned.csv');
  fs.writeFileSync(cleanedFile, outputLines.join('\n'), 'utf-8');

  console.log(`  Kept: ${kept}`);
  console.log(`  Removed: ${removed}\n`);

  console.log('📊 Removal Breakdown:');
  Object.entries(removalStats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}`);
    });

  console.log(`\n📄 Output file: products_export_cleaned.csv`);
  console.log(`   Original size: ${(fs.statSync(exportFile).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Cleaned size: ${(fs.statSync(cleanedFile).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Original lines: ${exportLines.length.toLocaleString()}`);
  console.log(`   Cleaned lines: ${outputLines.length.toLocaleString()}`);
  console.log(`   Removed: ${((removed / (exportLines.length - 1)) * 100).toFixed(1)}%\n`);

  console.log('✨ Done! Next steps:');
  console.log('  1. Review products_export_cleaned.csv');
  console.log('  2. Upload to Shopify via Admin > Products > Import');
  console.log('  3. Select "Overwrite existing products" option\n');
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
