-- CreateTable
CREATE TABLE "portal_user_app_visibility" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "groupId" TEXT,
    "appId" TEXT,
    "visible" BOOLEAN NOT NULL,

    CONSTRAINT "portal_user_app_visibility_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "portal_users" ADD COLUMN "onboardingDone" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "portal_user_app_visibility_portalUserId_groupId_key" ON "portal_user_app_visibility"("portalUserId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_user_app_visibility_portalUserId_appId_key" ON "portal_user_app_visibility"("portalUserId", "appId");

-- CreateIndex
CREATE INDEX "portal_user_app_visibility_portalUserId_idx" ON "portal_user_app_visibility"("portalUserId");

-- CreateIndex
CREATE INDEX "portal_user_app_visibility_groupId_idx" ON "portal_user_app_visibility"("groupId");

-- CreateIndex
CREATE INDEX "portal_user_app_visibility_appId_idx" ON "portal_user_app_visibility"("appId");

-- AddForeignKey
ALTER TABLE "portal_user_app_visibility" ADD CONSTRAINT "portal_user_app_visibility_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_user_app_visibility" ADD CONSTRAINT "portal_user_app_visibility_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "portal_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_user_app_visibility" ADD CONSTRAINT "portal_user_app_visibility_appId_fkey" FOREIGN KEY ("appId") REFERENCES "portal_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;