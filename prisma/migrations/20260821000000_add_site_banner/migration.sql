-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN "bannerText" TEXT,
ADD COLUMN "bannerEnabled" BOOLEAN NOT NULL DEFAULT false;
