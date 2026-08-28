-- AlterTable: portal_users — ADDITIVE HRIS fields (TASK-29)
ALTER TABLE "portal_users" ADD COLUMN "email" TEXT;
ALTER TABLE "portal_users" ADD COLUMN "nikHris" TEXT;
ALTER TABLE "portal_users" ADD COLUMN "nikSantos" TEXT;
ALTER TABLE "portal_users" ADD COLUMN "eligible" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "portal_users" ADD COLUMN "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "portal_users" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- CreateIndex: portal_users (filter perf per desain Jim §1.3)
CREATE INDEX "portal_users_nikHris_idx" ON "portal_users"("nikHris");
CREATE INDEX "portal_users_nikSantos_idx" ON "portal_users"("nikSantos");
CREATE INDEX "portal_users_eligible_idx" ON "portal_users"("eligible");

-- CreateTable: hris_gateway_config (singleton, id default 1)
CREATE TABLE "hris_gateway_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "lastPingAt" TIMESTAMP(3),
    "pingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hris_gateway_config_pkey" PRIMARY KEY ("id")
);