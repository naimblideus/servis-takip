-- FATURA SAYACI: sayaç "önce artır, sonra kullan" (lib/invoicing nextInvoiceNumber);
-- şemanın varsayılanı 1 olduğu için yeni bayinin ilk faturası 00002 çıkıyordu.
-- Yeni bayiler artık 0 ile açılıyor (lib/tenant-manager). Henüz HİÇ faturası
-- olmayan eski bayiler de 0'a çekilir; faturası olanın sayacına dokunulmaz
-- (dokunmak mükerrer numara demek). Göçler her açılışta yeniden koşar:
-- koşul yalnız faturasız ve sayacı 1 olanı seçtiği için tekrar koşmak zararsız.
UPDATE "Tenant" t SET "nextInvoiceSeq" = 0
WHERE t."nextInvoiceSeq" = 1
  AND NOT EXISTS (SELECT 1 FROM "CustomerInvoice" i WHERE i."tenantId" = t."id");
