-- OKUNMAYAN AY FAZLA FATURA ÜRETMEZ (2026-10-24): dahil paket okunmayan aylar
-- kadar uygulanır (lib/invoicing sayacAyCarpanlari). Göçler her açılışta
-- yeniden koşar: IF NOT EXISTS.
ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "renkliOlculdu" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "dahilSayfa" INTEGER;
ALTER TABLE "InvoiceLine" ADD COLUMN IF NOT EXISTS "ayCarpani" INTEGER;
