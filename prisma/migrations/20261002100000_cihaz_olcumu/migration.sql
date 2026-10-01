-- Cihazdan ölçülen durum: ağ tarayıcısının her çalışmasında, sistemdeki tek
-- bir cihaza eşleşen yazıcının toner yüzdesi ve kendi bildirdiği uyarılar
-- (sıkışma, servis gerekli, toner bitti...) cihaz kartına yazılır.
-- uyariAt: şu anki uyarıların ilk görüldüğü an ("2 gündür sıkışık").
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "olcumAt" TIMESTAMP(3);
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "olcumSiyah" INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "olcumRenkli" INTEGER;
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "cihazUyarilari" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "uyariAt" TIMESTAMP(3);

-- Taramayı gönderen betiğin sürümü: eski sürüm arıza durumunu okumaz,
-- panel o bilgisayar için "yeniden indirin" der.
ALTER TABLE "SayacTaramasi" ADD COLUMN IF NOT EXISTS "surum" INTEGER;
