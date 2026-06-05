-- Per-site Hero/Pin: move placement flags onto the junction table
-- and backfill articles that have no site association at all.

-- 1. New per-site flags on the junction
ALTER TABLE "announcement_sites" ADD COLUMN "isHero" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "announcement_sites" ADD COLUMN "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill existing junction rows from the global announcement flags
UPDATE "announcement_sites" a
SET "isHero" = x."isHero",
    "isPinned" = x."isPinned"
FROM "announcements" x
WHERE a."announcementId" = x."id";

-- 3. Backfill orphan announcements (no association) -> attach to the default site
--    Falls back to the first site if no site is flagged isDefault.
INSERT INTO "announcement_sites"
  ("id", "announcementId", "siteId", "isPrimary", "isHero", "isPinned", "publishedAt")
SELECT gen_random_uuid()::text, a."id", s."id", true, a."isHero", a."isPinned", NOW()
FROM "announcements" a
CROSS JOIN (
  SELECT "id" FROM "sites"
  ORDER BY "isDefault" DESC, "createdAt" ASC
  LIMIT 1
) s
WHERE NOT EXISTS (
  SELECT 1 FROM "announcement_sites" j WHERE j."announcementId" = a."id"
);

-- 4. Indexes for per-site hero/pin lookups
CREATE INDEX "announcement_sites_siteId_isHero_idx"   ON "announcement_sites"("siteId", "isHero");
CREATE INDEX "announcement_sites_siteId_isPinned_idx" ON "announcement_sites"("siteId", "isPinned");
