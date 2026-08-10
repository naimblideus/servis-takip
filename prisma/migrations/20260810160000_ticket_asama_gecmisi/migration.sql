-- SERVIS FISI ASAMA GECMISI
--
-- NEDEN: ServiceTicket.status tek alan, PATCH uzerine yaziyor; statusUpdatedAt
-- yalniz SON degisimi tutuyor. "Fis 3 gun parca bekledi mi", "kim ne zaman
-- hazir dedi" sorularinin cevabi hicbir yerde yoktu. Musteri panelinde asama
-- cizelgesi gostermek icin gecmis sart.
--
-- SILINMEZ, UZERINE YAZILMAZ: her gecis yeni satir.

CREATE TABLE IF NOT EXISTS "TicketStatusHistory" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "ticketId"        TEXT NOT NULL,
  "status"          "TicketStatus" NOT NULL,
  "oncekiStatus"    "TicketStatus",
  "changedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedByUserId" TEXT,
  "kaynak"          TEXT NOT NULL DEFAULT 'PANEL',
  "notu"            TEXT,
  CONSTRAINT "TicketStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TicketStatusHistory_ticketId_changedAt_idx" ON "TicketStatusHistory"("ticketId", "changedAt");
CREATE INDEX IF NOT EXISTS "TicketStatusHistory_tenantId_changedAt_idx" ON "TicketStatusHistory"("tenantId", "changedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TicketStatusHistory_tenantId_fkey') THEN
    ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TicketStatusHistory_ticketId_fkey') THEN
    ALTER TABLE "TicketStatusHistory" ADD CONSTRAINT "TicketStatusHistory_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "ServiceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── GECMIS FISLERIN DEVRI ────────────────────────────────────────────────
-- Mevcut fislerin gecmisi YOK. Elimizde SADECE iki gercek zaman var:
--   createdAt       = fis acildi (o an NEW idi)
--   statusUpdatedAt = son durum degisimi
-- Arada hangi asamalardan gectigi BILINMIYOR ve UYDURULMUYOR. Bu iki satir
-- kaynak='GECMIS' ile isaretleniyor; arayuz "ara asamalar kayitli degil"
-- diyebilsin diye.
--
-- Bu blok yalnizca hic gecmisi olmayan fisler icin calisir → tekrar kosunca
-- cift kayit uretmez (idempotent).

INSERT INTO "TicketStatusHistory" ("id","tenantId","ticketId","status","oncekiStatus","changedAt","kaynak","notu")
SELECT
  'gec_' || t."id" || '_a',
  t."tenantId", t."id", 'NEW'::"TicketStatus", NULL, t."createdAt", 'GECMIS',
  'Devir kaydi: fis acilisi'
FROM "ServiceTicket" t
WHERE NOT EXISTS (SELECT 1 FROM "TicketStatusHistory" h WHERE h."ticketId" = t."id")
ON CONFLICT ("id") DO NOTHING;

-- Ikinci satir yalnizca durum NEW'den farkliysa ve zaman gercekten ilerlemisse
INSERT INTO "TicketStatusHistory" ("id","tenantId","ticketId","status","oncekiStatus","changedAt","kaynak","notu")
SELECT
  'gec_' || t."id" || '_b',
  t."tenantId", t."id", t."status", 'NEW'::"TicketStatus", t."statusUpdatedAt", 'GECMIS',
  'Devir kaydi: ara asamalar kayitli degil'
FROM "ServiceTicket" t
WHERE t."status" <> 'NEW'
  AND t."statusUpdatedAt" > t."createdAt"
  AND NOT EXISTS (
    SELECT 1 FROM "TicketStatusHistory" h
    WHERE h."ticketId" = t."id" AND h."id" <> 'gec_' || t."id" || '_a'
  )
ON CONFLICT ("id") DO NOTHING;
