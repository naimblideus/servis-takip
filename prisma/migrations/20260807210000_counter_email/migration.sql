-- Cihazin kendi gonderdigi sayac e-postasi.
--
-- NE ISE YARAR: Cok fonksiyonlu cihazlar ayin belirli bir gunu sayac raporunu
-- e-postayla gonderebiliyor. Bu e-posta okunup cihaza islenince sayac toplama
-- tamamen otomatiklesir: bayi ne geziyor, ne telefonla koveliyor, ne fotograf bekliyor.
-- Okuma kaydedilince mevcut aylik faturalama zinciri onu kendiliginde aliyor.
--
-- NEDEN HAM METIN SAKLANIYOR: seri eslesmezse ya da sayac okunamazsa e-posta
-- SESSIZCE KAYBOLMAMALI. Inceleme kuyrugunda gorunur, elle islenir; ayrica yeni
-- bir cihaz bicimi ciktiginda gecmis e-postalar uzerinden okuyucu duzeltilebilir.
--
-- tenantId NULL olabilir: seri eslesene kadar hangi bayiye ait oldugu bilinmiyor.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

CREATE TABLE IF NOT EXISTS "CounterEmail" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT,
  "fromAddress" TEXT,
  "subject"     TEXT,
  "rawText"     TEXT NOT NULL,
  "serial"      TEXT,
  "deviceId"    TEXT,
  "parsedBlack" INTEGER,
  "parsedColor" INTEGER,
  "status"      TEXT NOT NULL DEFAULT 'BEKLIYOR',
  "readingId"   TEXT,
  "hata"        TEXT,
  "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CounterEmail_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CounterEmail_status_receivedAt_idx" ON "CounterEmail"("status", "receivedAt");
CREATE INDEX IF NOT EXISTS "CounterEmail_tenantId_status_idx"   ON "CounterEmail"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CounterEmail_deviceId_idx"          ON "CounterEmail"("deviceId");
