-- KAÇAN TONER: tarayıcının gördüğü ama bayinin vermediği toner değişimi
-- (lib/kacan-toner.ts). Bayi "bizden aldı, kaydı eksikti" derse işaretlenir
-- ve listeden düşer. Göçler her açılışta yeniden koşar: IF NOT EXISTS.
ALTER TABLE "TonerChange" ADD COLUMN IF NOT EXISTS "bizdenAlindi" BOOLEAN NOT NULL DEFAULT false;
