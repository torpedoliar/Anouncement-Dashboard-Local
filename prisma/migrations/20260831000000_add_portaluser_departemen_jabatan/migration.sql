-- TASK-39: PortalUser +2 field HRIS (additive nullable) untuk pull-based sync /employees
ALTER TABLE "portal_users" ADD COLUMN "departemen" TEXT;
ALTER TABLE "portal_users" ADD COLUMN "jabatan" TEXT;
