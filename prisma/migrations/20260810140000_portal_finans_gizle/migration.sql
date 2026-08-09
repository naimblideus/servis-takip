-- MUSTERI PANELI: mali bilgileri gizleme secenegi.
--
-- NEDEN: bazi bayiler musterisinin bakiyesini gormesini istemez — pazarlikta
-- eli zayiflar. Sahada bu itiraz kesin geliyor, secenek olmazsa bayi paneli
-- hic acmaz.
--
-- TEK BAYRAK, UC BOLUM: kapatilinca bakiye karti + fatura listesi + servis
-- fisi tutarlari birden gizlenir. Birini acik birakmak digerini ele verir
-- (fatura listesi zaten bakiyeyi topla-cikar ettirir).
--
-- VARSAYILAN true: panel zaten musteri bazinda kapali geliyor (portalEnabled),
-- yani bayi zaten bilincli bir karar veriyor. Varsayilan false olsaydi panelin
-- en degerli parcasi kimse fark etmeden kapali kalirdi.
--
-- IDEMPOTENT: apply-migrations.js her acilista tum migration'lari calistirir.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "portalShowFinancials" BOOLEAN NOT NULL DEFAULT true;
