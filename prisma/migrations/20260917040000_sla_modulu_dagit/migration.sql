-- YENİ MODÜL (SLA) — ELLE LİSTESİ OLAN BAYİLERE DE AÇ
--
-- Bayinin modül listesi doluysa o liste MUTLAKtır: süper admin "tam olarak
-- şunlar" demiştir ve plan varsayılanı devre dışı kalır. Bu doğru kural, ama
-- yeni bir modül çıktığında ters işliyor: o listeler SLA'dan ÖNCE yazıldı,
-- yani kimse SLA hakkında bir karar vermedi. Dokunmasaydık paketi SLA'yı
-- kapsayan bayilerin hiçbiri yeni modülü göremeyecekti — susarak "kapalı"
-- demiş olurduk.
--
-- Bu yüzden yalnız PAKETİ ZATEN SLA'YI KAPSAYAN bayilere ekliyoruz
-- (professional / enterprise / trial). Paketi kapsamayan bayiye eklemiyoruz:
-- ücretsiz yükseltme yapmak da bir karar ve o karar bizim değil.
--
-- İdempotent: zaten listede olana dokunmaz.

UPDATE "Tenant"
SET "modules" = array_append("modules", 'SLA')
WHERE cardinality("modules") > 0
  AND 'SLA' <> ALL("modules")
  AND "plan" IN ('trial', 'professional', 'enterprise');
