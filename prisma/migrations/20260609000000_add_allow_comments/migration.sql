-- Per-article comment toggle: allow or disable comments on individual announcements.
ALTER TABLE "announcements" ADD COLUMN "allowComments" BOOLEAN NOT NULL DEFAULT true;
