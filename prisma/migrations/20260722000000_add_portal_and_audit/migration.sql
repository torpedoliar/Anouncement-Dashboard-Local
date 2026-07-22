-- CreateEnum: PortalRole
CREATE TYPE "PortalRole" AS ENUM ('PORTAL_ADMIN', 'PORTAL_USER');

-- CreateEnum: PortalAppRole
CREATE TYPE "PortalAppRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum: PortalSsoMode
CREATE TYPE "PortalSsoMode" AS ENUM ('FORM', 'REDIRECT', 'PROXY', 'TOKEN');

-- CreateEnum: AuditActor
CREATE TYPE "AuditActor" AS ENUM ('ADMIN_USER', 'PORTAL_USER', 'SYSTEM');

-- CreateEnum: AuditOutcome
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum: AuditCategory
CREATE TYPE "AuditCategory" AS ENUM ('AUTH', 'CONTENT', 'USER_MGMT', 'PORTAL', 'SECURITY', 'SYSTEM', 'CONFIG');

-- CreateTable: portal_users
CREATE TABLE "portal_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "PortalRole" NOT NULL DEFAULT 'PORTAL_USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable: portal_apps
CREATE TABLE "portal_apps" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoPath" TEXT,
    "url" TEXT NOT NULL,
    "loginUrl" TEXT NOT NULL,
    "ssoMode" "PortalSsoMode" NOT NULL DEFAULT 'FORM',
    "httpMethod" TEXT NOT NULL DEFAULT 'POST',
    "usernameField" TEXT NOT NULL DEFAULT 'username',
    "passwordField" TEXT NOT NULL DEFAULT 'password',
    "extraFields" JSONB,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_apps_pkey" PRIMARY KEY ("id")
);

-- CreateTable: portal_user_app_access
CREATE TABLE "portal_user_app_access" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "role" "PortalAppRole" NOT NULL DEFAULT 'USER',

    CONSTRAINT "portal_user_app_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable: portal_user_app_credentials
CREATE TABLE "portal_user_app_credentials" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "credentialBlob" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_user_app_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable: portal_sessions
CREATE TABLE "portal_sessions" (
    "id" TEXT NOT NULL,
    "portalUserId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: audit_logs
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorType" "AuditActor" NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "actorName" TEXT,
    "category" "AuditCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "changes" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "severity" "LogSeverity" NOT NULL DEFAULT 'INFO',
    "siteId" TEXT,
    "appId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portalUserId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: portal_users
CREATE UNIQUE INDEX "portal_users_email_key" ON "portal_users"("email");
CREATE INDEX "portal_users_isActive_idx" ON "portal_users"("isActive");
CREATE INDEX "portal_users_role_idx" ON "portal_users"("role");

-- CreateIndex: portal_apps
CREATE UNIQUE INDEX "portal_apps_slug_key" ON "portal_apps"("slug");
CREATE INDEX "portal_apps_isActive_idx" ON "portal_apps"("isActive");
CREATE INDEX "portal_apps_category_idx" ON "portal_apps"("category");
CREATE INDEX "portal_apps_displayOrder_idx" ON "portal_apps"("displayOrder");

-- CreateIndex: portal_user_app_access
CREATE UNIQUE INDEX "portal_user_app_access_portalUserId_appId_key" ON "portal_user_app_access"("portalUserId", "appId");
CREATE INDEX "portal_user_app_access_portalUserId_idx" ON "portal_user_app_access"("portalUserId");
CREATE INDEX "portal_user_app_access_appId_idx" ON "portal_user_app_access"("appId");

-- CreateIndex: portal_user_app_credentials
CREATE UNIQUE INDEX "portal_user_app_credentials_portalUserId_appId_key" ON "portal_user_app_credentials"("portalUserId", "appId");
CREATE INDEX "portal_user_app_credentials_portalUserId_idx" ON "portal_user_app_credentials"("portalUserId");
CREATE INDEX "portal_user_app_credentials_appId_idx" ON "portal_user_app_credentials"("appId");

-- CreateIndex: portal_sessions
CREATE UNIQUE INDEX "portal_sessions_sessionToken_key" ON "portal_sessions"("sessionToken");
CREATE INDEX "portal_sessions_portalUserId_idx" ON "portal_sessions"("portalUserId");
CREATE INDEX "portal_sessions_sessionToken_idx" ON "portal_sessions"("sessionToken");

-- CreateIndex: audit_logs
CREATE INDEX "audit_logs_actorType_actorId_idx" ON "audit_logs"("actorType", "actorId");
CREATE INDEX "audit_logs_category_createdAt_idx" ON "audit_logs"("category", "createdAt");
CREATE INDEX "audit_logs_outcome_idx" ON "audit_logs"("outcome");
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- AddForeignKey: portal_user_app_access -> portal_users
ALTER TABLE "portal_user_app_access" ADD CONSTRAINT "portal_user_app_access_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: portal_user_app_access -> portal_apps
ALTER TABLE "portal_user_app_access" ADD CONSTRAINT "portal_user_app_access_appId_fkey" FOREIGN KEY ("appId") REFERENCES "portal_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: portal_user_app_credentials -> portal_users
ALTER TABLE "portal_user_app_credentials" ADD CONSTRAINT "portal_user_app_credentials_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: portal_user_app_credentials -> portal_apps
ALTER TABLE "portal_user_app_credentials" ADD CONSTRAINT "portal_user_app_credentials_appId_fkey" FOREIGN KEY ("appId") REFERENCES "portal_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: portal_sessions -> portal_users
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: audit_logs -> portal_users (optional, SetNull)
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
