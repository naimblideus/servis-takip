-- IDEMPOTENT: CounterReading.photo (sayaç okuması fotoğrafı; küçültülmüş JPEG data URL)
ALTER TABLE "CounterReading" ADD COLUMN IF NOT EXISTS "photo" TEXT;
