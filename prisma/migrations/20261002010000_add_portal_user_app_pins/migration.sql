-- Favorit beranda portal (spec 2026-10-02 §3.3).
CREATE TABLE "portal_user_app_pins" (
    "portalUserId" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_user_app_pins_pkey" PRIMARY KEY ("portalUserId","appId")
);

ALTER TABLE "portal_user_app_pins" ADD CONSTRAINT "portal_user_app_pins_portalUserId_fkey" FOREIGN KEY ("portalUserId") REFERENCES "portal_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portal_user_app_pins" ADD CONSTRAINT "portal_user_app_pins_appId_fkey" FOREIGN KEY ("appId") REFERENCES "portal_apps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
