-- IDEMPOTENT: Bayi Pazarı (B2B) — bayiler arası parça/makine ticareti

-- Tenant: pazara katılım (opt-in) + görünen profil
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "marketEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "marketDisplayName" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "marketCity" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "marketContactPhone" TEXT;

-- İlanlar
CREATE TABLE IF NOT EXISTS "MarketListing" (
  "id" TEXT NOT NULL,
  "sellerTenantId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "brand" TEXT,
  "model" TEXT,
  "condition" TEXT,
  "category" TEXT,
  "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'TRY',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit" TEXT,
  "city" TEXT,
  "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceKind" TEXT,
  "sourceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketListing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketListing_status_kind_idx" ON "MarketListing"("status", "kind");
CREATE INDEX IF NOT EXISTS "MarketListing_sellerTenantId_status_idx" ON "MarketListing"("sellerTenantId", "status");
CREATE INDEX IF NOT EXISTS "MarketListing_status_createdAt_idx" ON "MarketListing"("status", "createdAt");

-- Mesajlar (in-app iletişim)
CREATE TABLE IF NOT EXISTS "MarketMessage" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "sellerTenantId" TEXT NOT NULL,
  "buyerTenantId" TEXT NOT NULL,
  "senderTenantId" TEXT NOT NULL,
  "senderName" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketMessage_listingId_idx" ON "MarketMessage"("listingId");
CREATE INDEX IF NOT EXISTS "MarketMessage_sellerTenantId_listingId_idx" ON "MarketMessage"("sellerTenantId", "listingId");
CREATE INDEX IF NOT EXISTS "MarketMessage_buyerTenantId_listingId_idx" ON "MarketMessage"("buyerTenantId", "listingId");
