ALTER TABLE "portal_users" DROP COLUMN "email", ADD COLUMN "nik" TEXT NOT NULL; CREATE UNIQUE INDEX "portal_users_nik_key" ON "portal_users"("nik");
