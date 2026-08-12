-- Restricted apps + multi-credential
-- Tambah isPublic di portal_apps (default true = perilaku lama tetap publik)
ALTER TABLE "portal_apps" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

-- Multi-akun: label kredensial (default 'default' untuk data lama)
ALTER TABLE "portal_user_app_credentials" ADD COLUMN "label" TEXT NOT NULL DEFAULT 'default';

-- Ganti unique lama (satu user satu app) dengan unique baru (user, app, label)
ALTER TABLE "portal_user_app_credentials" DROP CONSTRAINT "portal_user_app_credentials_portalUserId_appId_key";

CREATE UNIQUE INDEX "portal_user_app_credentials_portalUserId_appId_label_key"
  ON "portal_user_app_credentials" ("portalUserId", "appId", "label");
