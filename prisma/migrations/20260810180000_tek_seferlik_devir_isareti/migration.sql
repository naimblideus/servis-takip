-- TEK SEFERLIK ISLEM ISARETI + PORTAL MODULUNUN ESKI BAYILERE ACILMASI
--
-- ── KOK SORUN ────────────────────────────────────────────────────────────
-- apply-migrations.js her konteyner acilisinda TUM migration.sql dosyalarini
-- yeniden kosuyor (bilerek; prisma CLI imajda yok). Sema islemleri idempotent
-- yazildigi icin sorun cikarmiyor AMA VERI islemleri icin bu yikici:
-- 20260621120000_add_tenant_modules icindeki UPDATE her acilista
--   modules = ARRAY['INVOICING','ROUTE','TRACKING','REVENUE_RISK','REPORTS','MARKETPLACE']
-- yaziyor (modules bossa). Bu dizide PORTAL YOK ve modules.ts dolu modules'u
-- MUTLAK OVERRIDE sayiyor -> plan varsayilani devreye girmiyor.
-- Sonuc: 2026-06-22 oncesi acilmis bayilerde (yani en eski, en uzun sure
-- odeyen bayilerde) Musteri Paneli hic gorunmuyor. Ayni tuzak bundan sonra
-- eklenecek HER yeni modul icin gecerli.
--
-- ── COZUM ────────────────────────────────────────────────────────────────
-- 1. Tek seferlik veri islemleri icin bir isaret tablosu. Bundan sonraki veri
--    devirleri bu tabloya bakip kendini bir kez calistiracak.
-- 2. Devir listesini AYNEN almis bayilere (yani hic elle modul secmemis
--    olanlara) PORTAL ekle. Elle modul secmis bayiye DOKUNMA — onun secimi
--    bilincli bir karardir.

CREATE TABLE IF NOT EXISTS "_TekSeferlikIslem" (
  "anahtar"  TEXT NOT NULL,
  "uygulandi" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "_TekSeferlikIslem_pkey" PRIMARY KEY ("anahtar")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "_TekSeferlikIslem" WHERE "anahtar" = 'portal-modulu-eski-bayilere') THEN

    -- Devir listesini AYNEN tasiyan bayiler = hic elle secim yapmamis olanlar.
    -- Uzunluk kontrolu sart: 6 anahtari icerip ustune baskasini eklemis bayi
    -- elle mudahale etmis demektir, ona dokunmuyoruz.
    UPDATE "Tenant"
      SET "modules" = "modules" || ARRAY['PORTAL']
      WHERE "plan" IN ('trial','professional','enterprise','pro')
        AND coalesce(array_length("modules", 1), 0) = 6
        AND "modules" @> ARRAY['INVOICING','ROUTE','TRACKING','REVENUE_RISK','REPORTS','MARKETPLACE']
        AND NOT ("modules" @> ARRAY['PORTAL']);

    INSERT INTO "_TekSeferlikIslem" ("anahtar") VALUES ('portal-modulu-eski-bayilere');
  END IF;
END $$;
