-- Tarayıcı kurulumu: kurulum kodu + kuruluma özel anahtar + canlı sinyal.
-- Yalnız yeni tablo ve iki boş sütun; mevcut veri değişmez.
CREATE TABLE "TarayiciKurulumu" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kod" TEXT NOT NULL,
    "kodBitis" TIMESTAMP(3) NOT NULL,
    "hedef" TEXT,
    "topluluk" TEXT,
    "anahtarOzet" TEXT,
    "kullanildiAt" TIMESTAMP(3),
    "bilgisayar" TEXT,
    "nabiz" JSONB,
    "sonGorulme" TIMESTAMP(3),
    "iptalAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TarayiciKurulumu_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TarayiciKurulumu_kod_key" ON "TarayiciKurulumu"("kod");
CREATE UNIQUE INDEX "TarayiciKurulumu_anahtarOzet_key" ON "TarayiciKurulumu"("anahtarOzet");
CREATE INDEX "TarayiciKurulumu_tenantId_createdAt_idx" ON "TarayiciKurulumu"("tenantId", "createdAt");
ALTER TABLE "TarayiciKurulumu" ADD CONSTRAINT "TarayiciKurulumu_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SayacTaramasi" ADD COLUMN "tani" JSONB;
ALTER TABLE "SayacTaramasi" ADD COLUMN "kurulumId" TEXT;
