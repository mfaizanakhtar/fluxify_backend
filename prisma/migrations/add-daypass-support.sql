-- Migration: Add daypass support to ProviderSkuMapping
-- Date: 2026-01-25
-- Description: Adds packageType and daysCount fields to handle daypass packages

-- Add packageType column (defaults to 'fixed' for existing records)
ALTER TABLE "ProviderSkuMapping"
ADD COLUMN "packageType" TEXT DEFAULT 'fixed';

-- Add daysCount column (nullable, only used for daypass packages)
ALTER TABLE "ProviderSkuMapping"
ADD COLUMN "daysCount" INTEGER;

-- Create index on packageType for faster queries
CREATE INDEX "ProviderSkuMapping_packageType_idx" ON "ProviderSkuMapping"("packageType");

-- Update comment
COMMENT ON COLUMN "ProviderSkuMapping"."packageType" IS 'Package type: fixed (normal validity period) or daypass (daily data allowance)';
COMMENT ON COLUMN "ProviderSkuMapping"."daysCount" IS 'Number of days for daypass packages (sent as daypassDays to FiRoam API)';
