-- KULLANICI DAVETİ (lib/kullanici-davet.ts): yönetici şifre yazıp söylemez;
-- kişiye tek kullanımlık bağlantı gider, şifresini kendisi belirler.
-- Jetonun kendisi saklanmaz, yalnız SHA-256 özeti. Göçler her açılışta yeniden
-- koşabilir: hepsi IF NOT EXISTS / duplicate_object korumalı.

-- Davetle açılıp şifresini henüz belirlemeyen kullanıcı. Varsayılan false:
-- mevcut bütün kullanıcılar etkilenmez.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "davetBekliyor" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "KullaniciDavet" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenOzeti" TEXT NOT NULL,
  "bitis" TIMESTAMP(3) NOT NULL,
  "kullanildi" TIMESTAMP(3),
  "olusturanAd" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KullaniciDavet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "KullaniciDavet_tokenOzeti_key" ON "KullaniciDavet"("tokenOzeti");
CREATE INDEX IF NOT EXISTS "KullaniciDavet_userId_idx" ON "KullaniciDavet"("userId");
CREATE INDEX IF NOT EXISTS "KullaniciDavet_tenantId_createdAt_idx" ON "KullaniciDavet"("tenantId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "KullaniciDavet" ADD CONSTRAINT "KullaniciDavet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
