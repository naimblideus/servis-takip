-- TONER DEĞİŞİM GEÇMİŞİ
-- Verimi bayiye sormak yerine ölçmek için: iki değişim arasında basılan
-- sayfa, o modelin sahada ölçülmüş gerçek verimidir.
CREATE TABLE "TonerChange" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "counterValue" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL,
    "observedYield" INTEGER,
    "partId" TEXT,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TonerChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TonerChange_tenantId_deviceId_channel_changedAt_idx" ON "TonerChange"("tenantId", "deviceId", "channel", "changedAt");
CREATE INDEX "TonerChange_tenantId_changedAt_idx" ON "TonerChange"("tenantId", "changedAt");

ALTER TABLE "TonerChange" ADD CONSTRAINT "TonerChange_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TonerChange" ADD CONSTRAINT "TonerChange_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- GEÇMİŞİ TAŞI: elde yalnız SON değişim var. Onu başlangıç referansı olarak
-- yazıyoruz; gözlenen verim null kalıyor (öncesi bilinmiyor, uydurulmuyor).
-- Bir sonraki değişimde ilk gerçek ölçüm çıkacak.
INSERT INTO "TonerChange" ("id", "tenantId", "deviceId", "channel", "counterValue", "changedAt", "observedYield", "source", "note")
SELECT
    'tc_b_' || "id",
    "tenantId", "id", 'BLACK', "tonerResetBlack",
    COALESCE("tonerChangedAt", "updatedAt"),
    NULL, 'GOC', 'Eski kayıttan taşındı'
FROM "Device"
WHERE "tonerResetBlack" IS NOT NULL;

INSERT INTO "TonerChange" ("id", "tenantId", "deviceId", "channel", "counterValue", "changedAt", "observedYield", "source", "note")
SELECT
    'tc_c_' || "id",
    "tenantId", "id", 'COLOR', "tonerResetColor",
    COALESCE("tonerChangedAt", "updatedAt"),
    NULL, 'GOC', 'Eski kayıttan taşındı'
FROM "Device"
WHERE "tonerResetColor" IS NOT NULL;
