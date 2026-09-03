-- Deep analysis login: konfigurasi LLM opsional (singleton) + feedback koreksi admin.
CREATE TABLE "portal_ai_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "baseUrl" TEXT,
    "model" TEXT,
    "apiKeyEncrypted" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_ai_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portal_detection_feedback" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "entryPath" TEXT NOT NULL,
    "detected" JSONB,
    "corrected" JSONB NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_detection_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "portal_detection_feedback_origin_entryPath_idx" ON "portal_detection_feedback"("origin", "entryPath");
