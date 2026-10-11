-- WhatsApp hatırlatmaları bayinin AÇIK RIZASIYLA: varsayılan kapalı.
-- Eski reminderEnabled (varsayılan açık, ekranı yoktu) artık kullanılmıyor;
-- onu sıfırlamak yerine yeni alan açıldı: göçler her açılışta yeniden koşar ve
-- bir UPDATE bayinin seçimini her yeniden başlatmada silerdi.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "vadeHatirlatma" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "sayacHatirlatma" BOOLEAN NOT NULL DEFAULT false;
