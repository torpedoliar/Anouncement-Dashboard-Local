-- Security hardening for Adaptive Login Profile evidence.
-- Historical detector prose can contain redirect queries or antiforgery-cookie
-- metadata. Keep only future canonical evidence and force v1 approvals through
-- the v2 discovery/review flow before any bound app can release credentials.

UPDATE "portal_login_profile_evidence"
SET
  "discoverySignals" = '[]'::jsonb,
  "warnings" = '[]'::jsonb;

UPDATE "portal_login_profiles"
SET
  "discoverySignals" = '[]'::jsonb,
  "warnings" = '[]'::jsonb,
  "lastError" = CASE
    WHEN "lastError" IS NULL THEN NULL
    ELSE 'Riwayat error lama dihapus selama hardening metadata.'
  END,
  "approvalStatus" = CASE
    WHEN "detectorVersion" <> 'adaptive-profile/v2' THEN 'PENDING'::"PortalLoginProfileApproval"
    ELSE "approvalStatus"
  END,
  "state" = CASE
    WHEN "detectorVersion" <> 'adaptive-profile/v2' THEN 'STALE'::"PortalLoginProfileState"
    ELSE "state"
  END,
  "staleAt" = CASE
    WHEN "detectorVersion" <> 'adaptive-profile/v2' THEN COALESCE("staleAt", CURRENT_TIMESTAMP)
    ELSE "staleAt"
  END;

-- PortalApp still has legacy detectionSignals used by the editor. Clear prior
-- detector prose so it cannot retain a query URL or cookie-derived metadata.
UPDATE "portal_apps"
SET "detectionSignals" = NULL
WHERE "detectionSignals" IS NOT NULL;
