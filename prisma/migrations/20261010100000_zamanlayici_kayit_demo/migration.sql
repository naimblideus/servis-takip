-- Uygulama içi zamanlayıcı: iş başına dönem sahiplenme (aynı dönemde tek çalışma).
CREATE TABLE IF NOT EXISTS "ZamanlanmisIs" (
  "anahtar" TEXT NOT NULL,
  "donem" TEXT NOT NULL,
  "basladiAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "bittiAt" TIMESTAMP(3),
  "durum" TEXT NOT NULL DEFAULT 'CALISIYOR',
  "mesaj" TEXT,
  "kaynak" TEXT,
  CONSTRAINT "ZamanlanmisIs_pkey" PRIMARY KEY ("anahtar")
);

-- Demo hesabı bayrağı: şifre/2FA değişikliği ve dışarıya mesaj demolarda kapalı.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "demo" BOOLEAN NOT NULL DEFAULT false;

-- Sitede kendi kendine deneme hesabı açma (süper admin kapatabilir).
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "kayitAcik" BOOLEAN NOT NULL DEFAULT true;

-- Önceki kurulumlardan kalan demo bayilerini işaretle. Yalnız demo kurulum
-- betiklerinin adları VE demo kullanıcı adresiyle doğrulananlar: gece demo
-- tazelemesi yalnız işaretli bayiyi siler (gerçek bayi asla).
UPDATE "Tenant" SET "demo" = true
WHERE "demo" <> true
  AND "slug" IN ('demo', 'demo-bayi', 'demo-bayi-1', 'demo-bayi-2', 'demo-bayi-3', 'demo-bayi-4', 'demo-bayi-5', 'demo-komsu-ankara', 'demo-komsu-izmir', 'demo-komsu-bursa')
  AND (
    "slug" LIKE 'demo-komsu-%'
    OR EXISTS (
      SELECT 1 FROM "User" u WHERE u."tenantId" = "Tenant"."id"
        AND (u."email" IN ('demo@nextusservis.com', 'demo@demo.com', 'tekniker@demo.com')
             OR u."email" ~ '^(demo|tekniker)[0-9]@demo\.com$'
             OR u."email" ~ '^demo[0-9]@servistakip\.com$')
    )
  );
