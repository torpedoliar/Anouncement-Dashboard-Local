-- Preserve safe SPA hash-route paths without storing fragment query/token values.
-- Existing v2 fingerprints remain valid for ordinary URLs; only candidates with
-- a normalized clientRoute add that field to their fingerprint snapshot.

ALTER TABLE "portal_login_profiles"
  ADD COLUMN "clientRoute" TEXT;

ALTER TABLE "portal_login_profile_evidence"
  ADD COLUMN "clientRoute" TEXT;

DROP INDEX IF EXISTS "portal_login_profiles_origin_entryPath_key";

CREATE UNIQUE INDEX "portal_login_profiles_origin_entryPath_clientRoute_key"
  ON "portal_login_profiles"("origin", "entryPath", "clientRoute");
