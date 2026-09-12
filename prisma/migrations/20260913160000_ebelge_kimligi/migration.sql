-- e-BELGE KIMLIGI (entegratorden BAGIMSIZ kisim)
--
-- Hangi ozel entegrator secilirse secilsin ayni bilgiler isteniyor:
-- belgenin evrensel tekil numarasi (ETTN), GIB bicimindeki belge numarasi,
-- senaryo (alici mukellef mi degil mi), belge tipi ve gonderim durumu.
-- Entegratore ozel HICBIR SEY burada yok; secim yapilinca yalniz bir
-- uyarlayici yazilacak.
--
-- ── IKI NUMARA AYRI SEY ──────────────────────────────────────────────────
-- SF-FAT-2026-00001  = bayinin kendi defter numarasi (bugunku invoiceNumber)
-- NXS2026000000001   = GIB belge numarasi (3 harf + yil + 9 hane)
-- Ikisini tek alanda tutmak, ya defteri ya belgeyi bozardi. Ustelik GIB
-- sirasinda BOSLUK olamaz ve yil doununce 1'den baslar; ic numaranin boyle
-- bir kisiti yok. Bu yuzden AYRI sayac (eFaturaSeq + eFaturaSeqYil).
--
-- ── KALEM BAZINDA KDV ────────────────────────────────────────────────────
-- Fatura basina TEK oran vardi. e-belgede KDV oran oran ayrisiyor ve farkli
-- oranli kalem gerektiginde fatura bunu temsil edemiyordu. vatRate NULL
-- birakiliyor: bugun hicbir yer doldurmuyor, yani mevcut hesap AYNEN
-- duruyor; null = faturanin genel orani.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eFaturaOnEk" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eFaturaSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eFaturaSeqYil" INTEGER;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "eFaturaEtiket" TEXT;

ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "ettn" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "gibNo" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "senaryo" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "faturaTipi" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "eBelgeDurum" TEXT;
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "eBelgeDurumAt" TIMESTAMP(3);
ALTER TABLE "CustomerInvoice" ADD COLUMN IF NOT EXISTS "eBelgeNot" TEXT;

-- ETTN evrensel tekil; GIB numarasi bayi icinde tekil. Ayni numaradan iki
-- belge cikarsa ikisi de gecersiz olur, bunu veritabani tutuyor.
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerInvoice_ettn_key"
  ON "CustomerInvoice"("ettn");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerInvoice_tenantId_gibNo_key"
  ON "CustomerInvoice"("tenantId", "gibNo");
CREATE INDEX IF NOT EXISTS "CustomerInvoice_tenantId_eBelgeDurum_idx"
  ON "CustomerInvoice"("tenantId", "eBelgeDurum");

ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2);
