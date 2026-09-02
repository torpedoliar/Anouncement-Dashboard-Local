-- Keep the non-FK fingerprint column coupled to the profile relation.
-- Prisma's ON DELETE SET NULL only clears loginProfileId, so clean any
-- historical partial bindings and install a database-level delete guard.

UPDATE "portal_apps"
SET "loginProfileFingerprint" = NULL
WHERE "loginProfileId" IS NULL
  AND "loginProfileFingerprint" IS NOT NULL;

CREATE OR REPLACE FUNCTION "clear_portal_login_profile_binding"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "portal_apps"
  SET
    "loginProfileId" = NULL,
    "loginProfileFingerprint" = NULL
  WHERE "loginProfileId" = OLD."id";

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS "portal_login_profile_clear_portal_app_binding"
  ON "portal_login_profiles";

CREATE TRIGGER "portal_login_profile_clear_portal_app_binding"
BEFORE DELETE ON "portal_login_profiles"
FOR EACH ROW
EXECUTE FUNCTION "clear_portal_login_profile_binding"();
