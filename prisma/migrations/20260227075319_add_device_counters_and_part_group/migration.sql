-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "counterBlack" INTEGER,
ADD COLUMN     "counterColor" INTEGER;

-- AlterTable
ALTER TABLE "Part" ADD COLUMN     "group" TEXT;
