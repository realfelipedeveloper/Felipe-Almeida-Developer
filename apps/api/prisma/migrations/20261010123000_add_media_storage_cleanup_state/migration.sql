ALTER TABLE "media_assets"
ADD COLUMN "storage_ready_at" TIMESTAMPTZ(3),
ADD COLUMN "storage_deleted_at" TIMESTAMPTZ(3);

UPDATE "media_assets"
SET "storage_ready_at" = "created_at"
WHERE "storage_ready_at" IS NULL;

CREATE INDEX "media_assets_storage_ready_at_deleted_at_storage_deleted_at_idx"
ON "media_assets"("storage_ready_at", "deleted_at", "storage_deleted_at");
