-- AlterTable
ALTER TABLE "portal_apps" ADD COLUMN "healthStatus" TEXT DEFAULT 'UNKNOWN',
ADD COLUMN "healthStatusCode" INTEGER,
ADD COLUMN "healthLatencyMs" INTEGER,
ADD COLUMN "healthCheckedAt" TIMESTAMP(3),
ADD COLUMN "healthError" TEXT;

-- CreateTable
CREATE TABLE "portal_app_health_logs" (
    "id" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "statusCode" INTEGER,
    "latencyMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_app_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_apps_healthStatus_idx" ON "portal_apps"("healthStatus");

-- CreateIndex
CREATE INDEX "portal_app_health_logs_appId_checkedAt_idx" ON "portal_app_health_logs"("appId", "checkedAt");

-- CreateIndex
CREATE INDEX "portal_app_health_logs_status_idx" ON "portal_app_health_logs"("status");

-- CreateIndex
CREATE INDEX "portal_app_health_logs_checkedAt_idx" ON "portal_app_health_logs"("checkedAt");

-- AddForeignKey
ALTER TABLE "portal_app_health_logs" ADD CONSTRAINT "portal_app_health_logs_appId_fkey" FOREIGN KEY ("appId") REFERENCES "portal_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
