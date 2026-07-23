-- CreateTable
CREATE TABLE "portal_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_group_apps" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,

    CONSTRAINT "portal_group_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_user_groups" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,

    CONSTRAINT "portal_user_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portal_groups_name_key" ON "portal_groups"("name");

-- CreateIndex
CREATE INDEX "portal_groups_isActive_idx" ON "portal_groups"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "portal_group_apps_groupId_appId_key" ON "portal_group_apps"("groupId", "appId");

-- CreateIndex
CREATE INDEX "portal_group_apps_groupId_idx" ON "portal_group_apps"("groupId");

-- CreateIndex
CREATE INDEX "portal_group_apps_appId_idx" ON "portal_group_apps"("appId");

-- CreateIndex
CREATE UNIQUE INDEX "portal_user_groups_portalUserId_groupId_key" ON "portal_user_groups"("portalUserId", "groupId");

-- CreateIndex
CREATE INDEX "portal_user_groups_portalUserId_idx" ON "portal_user_groups"("portalUserId");

-- CreateIndex
CREATE INDEX "portal_user_groups_groupId_idx" ON "portal_user_groups"("groupId");

-- AddForeignKey
ALTER TABLE "portal_group_apps" ADD CONSTRAINT "portal_group_apps_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "portal_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_group_apps" ADD CONSTRAINT "portal_group_apps_appId_fkey" FOREIGN KEY ("appId") REFERENCES "portal_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_user_groups" ADD CONSTRAINT "portal_user_groups_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_user_groups" ADD CONSTRAINT "portal_user_groups_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "portal_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: make loginUrl optional
ALTER TABLE "portal_apps" ALTER COLUMN "loginUrl" DROP NOT NULL;
