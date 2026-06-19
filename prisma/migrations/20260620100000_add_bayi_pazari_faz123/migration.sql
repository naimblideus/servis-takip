-- IDEMPOTENT: Bayi Pazarı Faz 1 (sipariş) + Faz 2 (settle alanları) + Faz 3 (yorum + komisyon)

-- Siparişler
CREATE TABLE IF NOT EXISTS "MarketOrder" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "sellerTenantId" TEXT NOT NULL,
  "buyerTenantId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "totalPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "note" TEXT,
  "buyerName" TEXT,
  "sellerName" TEXT,
  "listingTitle" TEXT,
  "listingKind" TEXT,
  "settledAt" TIMESTAMP(3),
  "commissionPct" DECIMAL(5,2),
  "commissionAmount" DECIMAL(10,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketOrder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MarketOrder_sellerTenantId_status_idx" ON "MarketOrder"("sellerTenantId", "status");
CREATE INDEX IF NOT EXISTS "MarketOrder_buyerTenantId_status_idx" ON "MarketOrder"("buyerTenantId", "status");
CREATE INDEX IF NOT EXISTS "MarketOrder_listingId_idx" ON "MarketOrder"("listingId");

-- Değerlendirmeler (puan/yorum)
CREATE TABLE IF NOT EXISTS "MarketReview" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "raterTenantId" TEXT NOT NULL,
  "ratedTenantId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MarketReview_orderId_key" ON "MarketReview"("orderId");
CREATE INDEX IF NOT EXISTS "MarketReview_ratedTenantId_idx" ON "MarketReview"("ratedTenantId");

-- Komisyon ayarı (platform)
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "marketCommissionPct" DECIMAL(5,2) NOT NULL DEFAULT 0;
