-- ESKİ PAKET ADLARINI DÜZELT — sessizce kapanan modüller
--
-- Panel içindeki eski süper admin ekranı yıllarca kendi paket listesini
-- yazıyordu: starter / standard / pro. Bunların yanına daha eski bir tohumdan
-- gelen "basic" de eklendi. Bu adların hiçbiri modules.ts'teki PLAN_MODULES'te
-- YOK ve kod `PLAN_MODULES[plan] ?? []` diyordu: yani bu paketteki bir bayinin
-- faturalama, rota, takip, kaçan gelir, raporlar, pazar, müşteri paneli ve
-- mağaza modüllerinin HEPSİ sessizce kapalıydı. Ne hata çıkıyordu ne uyarı.
--
-- Veritabanında ölçüldü: "basic" paketindeki üç bayinin modül listesi de BOŞ,
-- yani üçü de bugün hiçbir eklentiye erişemiyor.
--
-- EŞLEME (ad kısaltmasıdır, tier değişikliği değil):
--   basic    → starter        (giriş seviyesi)
--   pro      → professional
--   standard → professional   (eski üç kademede ortadaki ücretli kademe)
--
-- Paket adı bayinin FATURA TUTARINI değiştirmez: kullanıcı/fiş/depolama
-- limitleri bayinin kendi satırında ayrıca duruyor ve bu göç onlara dokunmaz.
-- Modül listesi elle verilmiş bayilerde de bir şey değişmez; değişen yalnız
-- listesi boş olanların doğru varsayılanı almasıdır.
--
-- İdempotent: ikinci koşuda eşleşecek satır kalmaz.

-- İkinci koşulda eşleşecek satır zaten kalmaz; `IS DISTINCT FROM` yine de
-- yazılıyor ki idempotentlik denetimi (scripts/test-goc-idempotent.mjs) bunu
-- OKUYABİLSİN. O denetim, her deploy'da veriyi yeniden ezen bir UPDATE'in
-- maliyet verisini sessizce bozduğu gerçek bir kazadan sonra yazıldı.
UPDATE "Tenant" SET "plan" = 'starter'
  WHERE "plan" = 'basic' AND "plan" IS DISTINCT FROM 'starter';
UPDATE "Tenant" SET "plan" = 'professional'
  WHERE "plan" IN ('pro', 'standard') AND "plan" IS DISTINCT FROM 'professional';
