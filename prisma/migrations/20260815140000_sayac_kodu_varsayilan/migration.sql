-- SAYAC KODUNU VERITABANI URETSIN
--
-- Onceki migration mevcut bayilere kod uretti, tenant-manager.ts de yeni
-- bayilere uretiyor. AMA bayi 6 ayri yerde olusturuluyor ve yalnizca biri
-- tenant-manager'dan geciyor (super-admin paneli). Digerleri — admin/setup,
-- admin/tenants, setup/seed, seed.ts, create-tenant.ts, seed-demo.mjs — kodsuz
-- bayi uretir. Kodsuz bayi, Ayarlar'da sayac kartini HIC gormez: ozellik o
-- bayide sessizce yoktur.
--
-- Cagri yerlerine tek tek eklemek kirilgan: 7. yol yarin yazilir ve yine
-- unutulur. Garantiyi veritabanina koyuyoruz — hangi kod yazarsa yazsin,
-- INSERT eden herkes kod alir.
--
-- Neden DEFAULT degil TRIGGER: sutun varsayilani yalnizca sutun HIC
-- yazilmadiginda calisir; acikca NULL yazan bir cagri onu atlar. Trigger her
-- iki durumu da yakalar. Ayni isi iki mekanizmaya boldurmuyoruz — TEK yol.
--
-- Alfabede 0/O ve 1/l/I bilerek yok: bu kod cihazin kucuk ekranina ELLE
-- giriliyor; yanlis okunan bir karakter, sayac e-postasinin hicbir bayiye
-- ulasmamasi demek.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

CREATE OR REPLACE FUNCTION sayac_kodu_uret() RETURNS TEXT AS $$
DECLARE
  alfabe TEXT := 'abcdefghjkmnpqrstuvwxyz23456789';
  yeni TEXT;
  i INT;
  deneme INT := 0;
BEGIN
  LOOP
    yeni := '';
    FOR i IN 1..8 LOOP
      yeni := yeni || substr(alfabe, 1 + floor(random() * length(alfabe))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "sayacEpostaKodu" = yeni);
    deneme := deneme + 1;
    -- 31^8 alanda cakisma pratikte imkansiz; yine de sonsuz donguye girmeyelim.
    -- 10 denemede bulunamazsa NULL don: bayi olusturma ASLA bu yuzden patlamasin.
    IF deneme >= 10 THEN RETURN NULL; END IF;
  END LOOP;
  RETURN yeni;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sayac_kodu_doldur() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."sayacEpostaKodu" IS NULL THEN
    NEW."sayacEpostaKodu" := sayac_kodu_uret();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "Tenant_sayac_kodu_doldur" ON "Tenant";
CREATE TRIGGER "Tenant_sayac_kodu_doldur"
  BEFORE INSERT ON "Tenant"
  FOR EACH ROW EXECUTE FUNCTION sayac_kodu_doldur();

-- Trigger'dan onceki kodsuz bayiler (ve bu migration'dan once olusanlar) icin
-- tarama. Kodu olana dokunmaz, oldugu gibi birakir.
UPDATE "Tenant" SET "sayacEpostaKodu" = sayac_kodu_uret() WHERE "sayacEpostaKodu" IS NULL;
