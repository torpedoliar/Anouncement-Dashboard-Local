-- Tiket #3: kolom kind di portal_groups + tabel alias nama departemen.
ALTER TABLE "portal_groups" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'MANUAL';
CREATE INDEX "portal_groups_kind_idx" ON "portal_groups"("kind");

CREATE TABLE "portal_name_aliases" (
    "id" TEXT NOT NULL,
    "tipe" TEXT NOT NULL DEFAULT 'DEPARTMENT',
    "rawName" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_name_aliases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "portal_name_aliases_tipe_rawName_key" ON "portal_name_aliases"("tipe", "rawName");
