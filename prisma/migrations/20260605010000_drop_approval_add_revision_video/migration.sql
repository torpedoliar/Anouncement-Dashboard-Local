-- Remove the unused content-approval workflow (no routes/UI ever implemented).
DROP TABLE IF EXISTS "approval_requests";
DROP TYPE IF EXISTS "ApprovalStatus";

-- Revision snapshots now also capture video media so restore is lossless.
ALTER TABLE "announcement_revisions" ADD COLUMN "videoPath" TEXT;
ALTER TABLE "announcement_revisions" ADD COLUMN "videoType" TEXT;
ALTER TABLE "announcement_revisions" ADD COLUMN "youtubeUrl" TEXT;
