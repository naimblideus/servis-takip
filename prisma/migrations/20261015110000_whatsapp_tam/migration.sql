-- WHATSAPP TAMAMLAMA (lib/whatsapp-graph, api/whatsapp/webhook):
--  · Giden mesajın Meta kimliği (wamid) ve teslim/okundu zamanı: Meta'nın sonradan
--    gönderdiği durum bildirimi gönderim kaydına bu kimlikle bağlanır; "gitti mi,
--    okundu mu, neden iletilemedi" sorusunun cevabı burada.
--  · Gelen kutusundan verilen cevap aynı tabloda (yon='GIDEN'): sohbet tek yerde.
--  · Müşteri "DUR" yazınca o bayiden hatırlatma almaz (WhatsAppRet). Tek platform
--    numarası bütün bayilerin; bir müşterinin şikâyeti numaranın kalitesini herkes için düşürür.
-- Göçler her açılışta yeniden koşar: IF NOT EXISTS.
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "waMessageId" TEXT;
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "teslimAt" TIMESTAMP(3);
ALTER TABLE "NotificationLog" ADD COLUMN IF NOT EXISTS "okunduAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationLog_waMessageId_key" ON "NotificationLog"("waMessageId");

ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "yon" TEXT NOT NULL DEFAULT 'GELEN';
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "durum" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "hata" TEXT;
ALTER TABLE "WhatsAppMessage" ADD COLUMN IF NOT EXISTS "gonderenUserId" TEXT;

-- Ret listesi telefon bazlı (son 10 hane) ve bayi başına: mağaza alıcısı servis
-- müşterisi olmayabilir; müşteri bir bayiyi durdurup ötekinden almaya devam edebilir.
CREATE TABLE IF NOT EXISTS "WhatsAppRet" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "son10" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppRet_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppRet_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppRet_tenantId_son10_key" ON "WhatsAppRet"("tenantId", "son10");
