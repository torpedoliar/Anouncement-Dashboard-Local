-- Profile deteksi login non-secret per origin + entrypoint.
-- Tidak ada cookie, token, HTML, nilai hidden field, atau kredensial di tabel ini.

CREATE TYPE "PortalLoginProfileState" AS ENUM (
  'DISCOVERED',
  'TRANSPORT_VALIDATED',
  'CREDENTIAL_ACCEPTED',
  'REJECTED',
  'STALE'
);

CREATE TYPE "PortalLoginProfileApproval" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "portal_login_profiles" (
  "id" TEXT NOT NULL,
  "origin" TEXT NOT NULL,
  "entryPath" TEXT NOT NULL,
  "finalPath" TEXT,
  "formActionPath" TEXT,
  "httpMethod" TEXT,
  "usernameField" TEXT,
  "passwordField" TEXT,
  "extraFieldNames" JSONB,
  "recommendedMode" "PortalSsoMode",
  "detectionLayer" TEXT NOT NULL,
  "discoveryConfidence" INTEGER,
  "discoverySignals" JSONB,
  "warnings" JSONB,
  "apiContracts" JSONB,
  "apiSpecPath" TEXT,
  "currentFingerprint" TEXT NOT NULL,
  "approvedFingerprint" TEXT,
  "approvalStatus" "PortalLoginProfileApproval" NOT NULL DEFAULT 'PENDING',
  "state" "PortalLoginProfileState" NOT NULL DEFAULT 'DISCOVERED',
  "detectorVersion" TEXT NOT NULL,
  "lastDiscoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastCheckedAt" TIMESTAMP(3),
  "lastTransportValidatedAt" TIMESTAMP(3),
  "lastCredentialAcceptedAt" TIMESTAMP(3),
  "staleAt" TIMESTAMP(3),
  "lastError" TEXT,
  "approvedAt" TIMESTAMP(3),
  "approvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "portal_login_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portal_login_profile_evidence" (
  "id" TEXT NOT NULL,
  "profileId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "finalPath" TEXT,
  "formActionPath" TEXT,
  "httpMethod" TEXT,
  "usernameField" TEXT,
  "passwordField" TEXT,
  "extraFieldNames" JSONB,
  "recommendedMode" "PortalSsoMode",
  "detectionLayer" TEXT NOT NULL,
  "discoveryConfidence" INTEGER,
  "discoverySignals" JSONB,
  "warnings" JSONB,
  "apiContracts" JSONB,
  "apiSpecPath" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "portal_login_profile_evidence_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "portal_apps"
  ADD COLUMN "loginProfileId" TEXT,
  ADD COLUMN "loginProfileFingerprint" TEXT;

CREATE UNIQUE INDEX "portal_login_profiles_origin_entryPath_key"
  ON "portal_login_profiles"("origin", "entryPath");
CREATE INDEX "portal_login_profiles_approvalStatus_idx"
  ON "portal_login_profiles"("approvalStatus");
CREATE INDEX "portal_login_profiles_state_idx"
  ON "portal_login_profiles"("state");
CREATE INDEX "portal_login_profiles_lastCheckedAt_idx"
  ON "portal_login_profiles"("lastCheckedAt");
CREATE INDEX "portal_login_profile_evidence_profileId_createdAt_idx"
  ON "portal_login_profile_evidence"("profileId", "createdAt");
CREATE INDEX "portal_login_profile_evidence_fingerprint_idx"
  ON "portal_login_profile_evidence"("fingerprint");
CREATE INDEX "portal_apps_loginProfileId_idx"
  ON "portal_apps"("loginProfileId");

ALTER TABLE "portal_login_profile_evidence"
  ADD CONSTRAINT "portal_login_profile_evidence_profileId_fkey"
  FOREIGN KEY ("profileId") REFERENCES "portal_login_profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "portal_apps"
  ADD CONSTRAINT "portal_apps_loginProfileId_fkey"
  FOREIGN KEY ("loginProfileId") REFERENCES "portal_login_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
