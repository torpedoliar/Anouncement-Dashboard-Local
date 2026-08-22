-- AlterTable
ALTER TABLE "portal_apps"
  ADD COLUMN "detectionConfidence" INTEGER,
  ADD COLUMN "detectionSignals" JSONB,
  ADD COLUMN "detectionLayer" TEXT,
  ADD COLUMN "detectedAt" TIMESTAMP(3),
  ADD COLUMN "loginVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "loginVerifyError" TEXT,
  ADD COLUMN "detectedFingerprint" TEXT,
  ADD COLUMN "loginFormChanged" BOOLEAN NOT NULL DEFAULT false;
