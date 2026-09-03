-- Memori deteksi: fingerprint struktur form generik yang terbukti lolos Uji Login.
CREATE TABLE "portal_product_fingerprint" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "formHash" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_product_fingerprint_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portal_product_fingerprint_origin_idx" ON "portal_product_fingerprint"("origin");
CREATE INDEX "portal_product_fingerprint_product_formHash_idx" ON "portal_product_fingerprint"("product", "formHash");
