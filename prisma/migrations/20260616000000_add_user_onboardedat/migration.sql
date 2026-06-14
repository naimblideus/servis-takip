-- IDEMPOTENT: User.onboardedAt (ilk-giris egitim sihirbazi durumu; null=hic gormedi)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);
