-- ŞİFRE SIFIRLAMA: e-postaya giden tek kullanımlık bağlantı (lib/sifre-sifirlama.ts).
-- Jetonun kendisi saklanmaz, yalnız SHA-256 özeti: veritabanını okuyan biri
-- bağlantıyı yeniden kuramaz. Göçler her açılışta yeniden koşar: IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS "SifreSifirlama" (
  "id" TEXT NOT NULL,
  "eposta" TEXT NOT NULL,
  "tokenOzeti" TEXT NOT NULL,
  "bitis" TIMESTAMP(3) NOT NULL,
  "kullanildi" TIMESTAMP(3),
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SifreSifirlama_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SifreSifirlama_tokenOzeti_key" ON "SifreSifirlama"("tokenOzeti");
CREATE INDEX IF NOT EXISTS "SifreSifirlama_eposta_createdAt_idx" ON "SifreSifirlama"("eposta", "createdAt");
