-- Marka/model TERS kayitlarini duzelt (idempotent, otomatik)
--
-- SORUN: ice aktarilan Excel'lerde "Marka" ve "Model" sutunlari ters doldurulmustu
-- (brand="M501DN", model="HP"). Tek bayide 1104 cihazin %97'si boyleydi.
-- Bu haliyle markaya gore gruplama imkansiz; marka bazli hicbir rapor calismaz.
--
-- NEDEN MIGRATION: scripts/ klasoru uretim imajina kopyalanmiyor, bu yuzden
-- elle calistirilacak bir script prod'da erisilebilir degil. Migration olarak
-- yazildiginda startup.sh ile deploy sirasinda kendiliginden uygulanir.
--
-- GUVENLIK:
--  - Yalnizca model alani BILINEN bir marka VE brand alani bilinen marka DEGILSE takas eder.
--  - Taninmayan marka (yerel markalar: Perkon, Mitaco vb.) OLDUGU GIBI kalir — tahmin yazilmaz.
--  - Idempotent: takastan sonra brand zaten bilinen marka olur, kosul bir daha eslesmez.
--  - Hicbir satir silinmez, baska hicbir alan degismez.
--
-- Ayni kurallar uygulama tarafinda da var (src/lib/device-brands.ts) — ice aktarma,
-- cihaz ekleme ve duzenlemede calisiyor, boylece hata bir daha birikmez.

-- 1) TERS KAYITLAR: marka<->model yer degistir, yazimi kanoniklestir
WITH bilinen(f, d) AS (
  VALUES
    ('canon','Canon'),('hp','HP'),('hewlettpackard','HP'),
    ('konica','Konica Minolta'),('konicaminolta','Konica Minolta'),('minolta','Konica Minolta'),
    ('pantum','Pantum'),('ninestar','Ninestar'),('xerox','Xerox'),('lexmark','Lexmark'),
    ('brother','Brother'),('samsung','Samsung'),('epson','Epson'),('kyocera','Kyocera'),
    ('ricoh','Ricoh'),('sharp','Sharp'),('oki','OKI'),('toshiba','Toshiba'),
    ('develop','Develop'),('olivetti','Olivetti'),('triumphadler','Triumph Adler'),
    ('utax','UTAX'),('panasonic','Panasonic'),('dell','Dell'),('kodak','Kodak'),
    ('riso','Riso'),('duplo','Duplo'),('nashuatec','Nashuatec'),
    ('gestetner','Gestetner'),('infotec','Infotec')
)
UPDATE "Device" dev
SET "brand" = b.d, "model" = dev."brand"
FROM bilinen b
WHERE lower(regexp_replace(translate(coalesce(dev."model",''),'ıİşŞğĞüÜöÖçÇ','iIsSgGuUoOcC'),'[^A-Za-z0-9]','','g')) = b.f
  AND NOT EXISTS (
    SELECT 1 FROM bilinen b2
    WHERE b2.f = lower(regexp_replace(translate(coalesce(dev."brand",''),'ıİşŞğĞüÜöÖçÇ','iIsSgGuUoOcC'),'[^A-Za-z0-9]','','g'))
  );

-- 2) YAZIM BIRLIGI: marka dogru alanda ama farkli yazilmis ("canon"/"CANON" -> "Canon")
WITH bilinen(f, d) AS (
  VALUES
    ('canon','Canon'),('hp','HP'),('hewlettpackard','HP'),
    ('konica','Konica Minolta'),('konicaminolta','Konica Minolta'),('minolta','Konica Minolta'),
    ('pantum','Pantum'),('ninestar','Ninestar'),('xerox','Xerox'),('lexmark','Lexmark'),
    ('brother','Brother'),('samsung','Samsung'),('epson','Epson'),('kyocera','Kyocera'),
    ('ricoh','Ricoh'),('sharp','Sharp'),('oki','OKI'),('toshiba','Toshiba'),
    ('develop','Develop'),('olivetti','Olivetti'),('triumphadler','Triumph Adler'),
    ('utax','UTAX'),('panasonic','Panasonic'),('dell','Dell'),('kodak','Kodak'),
    ('riso','Riso'),('duplo','Duplo'),('nashuatec','Nashuatec'),
    ('gestetner','Gestetner'),('infotec','Infotec')
)
UPDATE "Device" dev
SET "brand" = b.d
FROM bilinen b
WHERE lower(regexp_replace(translate(coalesce(dev."brand",''),'ıİşŞğĞüÜöÖçÇ','iIsSgGuUoOcC'),'[^A-Za-z0-9]','','g')) = b.f
  AND dev."brand" <> b.d;
