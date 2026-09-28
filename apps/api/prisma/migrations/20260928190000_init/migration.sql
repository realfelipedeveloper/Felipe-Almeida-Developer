-- Felipe Almeida Developer — migração inicial
-- Parte 03: PostgreSQL + Prisma
-- Gerada a partir de apps/api/prisma/schema.prisma.

CREATE TYPE "Locale" AS ENUM ('pt-BR', 'en', 'es');
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ProjectLifecycle" AS ENUM ('PLANNED', 'IN_PROGRESS', 'ACTIVE', 'COMPLETED', 'MAINTENANCE', 'PAUSED');
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'SPAM');
CREATE TYPE "NewsletterSubscriberStatus" AS ENUM ('PENDING', 'ACTIVE', 'UNSUBSCRIBED', 'BOUNCED');
CREATE TYPE "NewsletterTokenPurpose" AS ENUM ('CONFIRM_SUBSCRIPTION', 'UNSUBSCRIBE');
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'PDF');
CREATE TYPE "MediaStorageProvider" AS ENUM ('LOCAL', 'OBJECT_STORAGE');
CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'SUPER_ADMIN');
CREATE TYPE "PrivacyRequestType" AS ENUM ('EXPORT', 'DELETE');
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('PENDING', 'VERIFIED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'EXPIRED');
CREATE TYPE "ConsentCategory" AS ENUM ('ANALYTICS');

CREATE TABLE "admin_users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
  "active" BOOLEAN NOT NULL DEFAULT false,
  "must_change_password" BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_assets" (
  "id" UUID NOT NULL,
  "kind" "MediaKind" NOT NULL,
  "storage_provider" "MediaStorageProvider" NOT NULL DEFAULT 'LOCAL',
  "storage_key" VARCHAR(500) NOT NULL,
  "original_name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(160) NOT NULL,
  "extension" VARCHAR(20),
  "byte_size" BIGINT NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "created_by_admin_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "deleted_at" TIMESTAMPTZ(3),
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "media_translations" (
  "id" UUID NOT NULL,
  "media_asset_id" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "title" VARCHAR(180),
  "alt_text" VARCHAR(320),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "media_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profiles" (
  "id" UUID NOT NULL,
  "public_email" VARCHAR(320),
  "public_location" VARCHAR(160),
  "available_for_work" BOOLEAN NOT NULL DEFAULT true,
  "avatar_media_id" UUID,
  "resume_media_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_translations" (
  "id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "full_name" VARCHAR(160) NOT NULL,
  "headline" VARCHAR(220) NOT NULL,
  "summary" TEXT NOT NULL,
  "bio" TEXT NOT NULL,
  "seo_title" VARCHAR(180),
  "seo_description" VARCHAR(320),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "profile_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "social_links" (
  "id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "url" VARCHAR(500) NOT NULL,
  "icon_key" VARCHAR(80),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "social_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
  "id" UUID NOT NULL,
  "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "lifecycle" "ProjectLifecycle" NOT NULL DEFAULT 'IN_PROGRESS',
  "featured" BOOLEAN NOT NULL DEFAULT false,
  "started_at" DATE,
  "ended_at" DATE,
  "repository_url" VARCHAR(500),
  "demo_url" VARCHAR(500),
  "cover_media_id" UUID,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_translations" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "summary" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "challenges" TEXT,
  "solution" TEXT,
  "results" TEXT,
  "seo_title" VARCHAR(180),
  "seo_description" VARCHAR(320),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "project_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "technologies" (
  "id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "category" VARCHAR(100),
  "website_url" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "technologies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_technologies" (
  "project_id" UUID NOT NULL,
  "technology_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "project_technologies_pkey" PRIMARY KEY ("project_id", "technology_id")
);

CREATE TABLE "tags" (
  "id" UUID NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tag_translations" (
  "id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "slug" VARCHAR(140) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "tag_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "project_tags" (
  "project_id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  CONSTRAINT "project_tags_pkey" PRIMARY KEY ("project_id", "tag_id")
);

CREATE TABLE "project_media" (
  "project_id" UUID NOT NULL,
  "media_asset_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "project_media_pkey" PRIMARY KEY ("project_id", "media_asset_id")
);

CREATE TABLE "articles" (
  "id" UUID NOT NULL,
  "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "author_profile_id" UUID,
  "cover_media_id" UUID,
  "reading_time_minutes" INTEGER,
  "scheduled_at" TIMESTAMPTZ(3),
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article_translations" (
  "id" UUID NOT NULL,
  "article_id" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "summary" TEXT NOT NULL,
  "body_html" TEXT NOT NULL,
  "seo_title" VARCHAR(180),
  "seo_description" VARCHAR(320),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "article_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "article_tags" (
  "article_id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  CONSTRAINT "article_tags_pkey" PRIMARY KEY ("article_id", "tag_id")
);

CREATE TABLE "news" (
  "id" UUID NOT NULL,
  "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "cover_media_id" UUID,
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "news_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_translations" (
  "id" UUID NOT NULL,
  "news_id" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "summary" TEXT NOT NULL,
  "content_html" TEXT NOT NULL,
  "seo_title" VARCHAR(180),
  "seo_description" VARCHAR(320),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "news_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "news_tags" (
  "news_id" UUID NOT NULL,
  "tag_id" UUID NOT NULL,
  CONSTRAINT "news_tags_pkey" PRIMARY KEY ("news_id", "tag_id")
);

CREATE TABLE "contact_messages" (
  "id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "subject" VARCHAR(200) NOT NULL,
  "message" TEXT NOT NULL,
  "locale" "Locale" NOT NULL DEFAULT 'pt-BR',
  "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
  "ip_hash" VARCHAR(128),
  "correlation_id" UUID NOT NULL,
  "resolved_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "newsletter_subscribers" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "locale" "Locale" NOT NULL DEFAULT 'pt-BR',
  "status" "NewsletterSubscriberStatus" NOT NULL DEFAULT 'PENDING',
  "consent_source" VARCHAR(160),
  "consent_ip_hash" VARCHAR(128),
  "confirmed_at" TIMESTAMPTZ(3),
  "unsubscribed_at" TIMESTAMPTZ(3),
  "bounce_reason" VARCHAR(240),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "newsletter_tokens" (
  "id" UUID NOT NULL,
  "subscriber_id" UUID NOT NULL,
  "purpose" "NewsletterTokenPurpose" NOT NULL,
  "token_hash" VARCHAR(128) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "used_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "newsletter_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "newsletter_issues" (
  "id" UUID NOT NULL,
  "publication_status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "scheduled_at" TIMESTAMPTZ(3),
  "published_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "newsletter_issues_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "newsletter_issue_translations" (
  "id" UUID NOT NULL,
  "issue_id" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "subject" VARCHAR(220) NOT NULL,
  "preview_text" VARCHAR(320),
  "body_html" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "newsletter_issue_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seo_page_metadata" (
  "id" UUID NOT NULL,
  "page_key" VARCHAR(100) NOT NULL,
  "locale" "Locale" NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "description" VARCHAR(320) NOT NULL,
  "canonical_path" VARCHAR(300),
  "og_title" VARCHAR(180),
  "og_description" VARCHAR(320),
  "no_index" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "seo_page_metadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "consent_records" (
  "id" UUID NOT NULL,
  "subject_key" VARCHAR(128) NOT NULL,
  "category" "ConsentCategory" NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "policy_version" VARCHAR(40) NOT NULL,
  "locale" "Locale" NOT NULL DEFAULT 'pt-BR',
  "source" VARCHAR(120),
  "ip_hash" VARCHAR(128),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "privacy_requests" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "type" "PrivacyRequestType" NOT NULL,
  "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'PENDING',
  "verification_token_hash" VARCHAR(128),
  "verification_expires_at" TIMESTAMPTZ(3),
  "verified_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "result_storage_key" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "privacy_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "event_name" VARCHAR(160) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "aggregate_type" VARCHAR(120),
  "aggregate_id" VARCHAR(120),
  "correlation_id" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "processed_events" (
  "id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "consumer" VARCHAR(160) NOT NULL,
  "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL,
  "actor_admin_id" UUID,
  "action" VARCHAR(160) NOT NULL,
  "resource_type" VARCHAR(120) NOT NULL,
  "resource_id" VARCHAR(120),
  "correlation_id" UUID,
  "ip_hash" VARCHAR(128),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings" (
  "key" VARCHAR(120) NOT NULL,
  "value" JSONB NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");
CREATE INDEX "media_assets_kind_deleted_at_idx" ON "media_assets"("kind", "deleted_at");
CREATE INDEX "media_assets_sha256_idx" ON "media_assets"("sha256");
CREATE UNIQUE INDEX "media_translations_media_asset_id_locale_key" ON "media_translations"("media_asset_id", "locale");
CREATE UNIQUE INDEX "profile_translations_profile_id_locale_key" ON "profile_translations"("profile_id", "locale");
CREATE INDEX "profile_translations_locale_idx" ON "profile_translations"("locale");
CREATE INDEX "social_links_profile_id_visible_sort_order_idx" ON "social_links"("profile_id", "visible", "sort_order");
CREATE INDEX "projects_publication_status_featured_sort_order_idx" ON "projects"("publication_status", "featured", "sort_order");
CREATE INDEX "projects_lifecycle_idx" ON "projects"("lifecycle");
CREATE UNIQUE INDEX "project_translations_project_id_locale_key" ON "project_translations"("project_id", "locale");
CREATE UNIQUE INDEX "project_translations_locale_slug_key" ON "project_translations"("locale", "slug");
CREATE INDEX "project_translations_locale_title_idx" ON "project_translations"("locale", "title");
CREATE UNIQUE INDEX "technologies_name_key" ON "technologies"("name");
CREATE UNIQUE INDEX "technologies_slug_key" ON "technologies"("slug");
CREATE INDEX "project_technologies_technology_id_idx" ON "project_technologies"("technology_id");
CREATE UNIQUE INDEX "tags_key_key" ON "tags"("key");
CREATE UNIQUE INDEX "tag_translations_tag_id_locale_key" ON "tag_translations"("tag_id", "locale");
CREATE UNIQUE INDEX "tag_translations_locale_slug_key" ON "tag_translations"("locale", "slug");
CREATE INDEX "project_tags_tag_id_idx" ON "project_tags"("tag_id");
CREATE INDEX "project_media_media_asset_id_idx" ON "project_media"("media_asset_id");
CREATE INDEX "articles_publication_status_published_at_idx" ON "articles"("publication_status", "published_at");
CREATE INDEX "articles_scheduled_at_idx" ON "articles"("scheduled_at");
CREATE UNIQUE INDEX "article_translations_article_id_locale_key" ON "article_translations"("article_id", "locale");
CREATE UNIQUE INDEX "article_translations_locale_slug_key" ON "article_translations"("locale", "slug");
CREATE INDEX "article_translations_locale_title_idx" ON "article_translations"("locale", "title");
CREATE INDEX "article_tags_tag_id_idx" ON "article_tags"("tag_id");
CREATE INDEX "news_publication_status_published_at_idx" ON "news"("publication_status", "published_at");
CREATE UNIQUE INDEX "news_translations_news_id_locale_key" ON "news_translations"("news_id", "locale");
CREATE UNIQUE INDEX "news_translations_locale_slug_key" ON "news_translations"("locale", "slug");
CREATE INDEX "news_translations_locale_title_idx" ON "news_translations"("locale", "title");
CREATE INDEX "news_tags_tag_id_idx" ON "news_tags"("tag_id");
CREATE INDEX "contact_messages_status_created_at_idx" ON "contact_messages"("status", "created_at");
CREATE INDEX "contact_messages_email_idx" ON "contact_messages"("email");
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");
CREATE INDEX "newsletter_subscribers_status_locale_idx" ON "newsletter_subscribers"("status", "locale");
CREATE UNIQUE INDEX "newsletter_tokens_token_hash_key" ON "newsletter_tokens"("token_hash");
CREATE INDEX "newsletter_tokens_subscriber_id_purpose_expires_at_idx" ON "newsletter_tokens"("subscriber_id", "purpose", "expires_at");
CREATE INDEX "newsletter_issues_publication_status_published_at_idx" ON "newsletter_issues"("publication_status", "published_at");
CREATE UNIQUE INDEX "newsletter_issue_translations_issue_id_locale_key" ON "newsletter_issue_translations"("issue_id", "locale");
CREATE UNIQUE INDEX "seo_page_metadata_page_key_locale_key" ON "seo_page_metadata"("page_key", "locale");
CREATE INDEX "seo_page_metadata_locale_no_index_idx" ON "seo_page_metadata"("locale", "no_index");
CREATE INDEX "consent_records_subject_key_category_created_at_idx" ON "consent_records"("subject_key", "category", "created_at");
CREATE UNIQUE INDEX "privacy_requests_verification_token_hash_key" ON "privacy_requests"("verification_token_hash");
CREATE INDEX "privacy_requests_email_status_idx" ON "privacy_requests"("email", "status");
CREATE INDEX "outbox_events_published_at_available_at_idx" ON "outbox_events"("published_at", "available_at");
CREATE INDEX "outbox_events_event_name_occurred_at_idx" ON "outbox_events"("event_name", "occurred_at");
CREATE UNIQUE INDEX "processed_events_event_id_consumer_key" ON "processed_events"("event_id", "consumer");
CREATE INDEX "processed_events_consumer_processed_at_idx" ON "processed_events"("consumer", "processed_at");
CREATE INDEX "audit_logs_actor_admin_id_created_at_idx" ON "audit_logs"("actor_admin_id", "created_at");
CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx" ON "audit_logs"("resource_type", "resource_id", "created_at");

ALTER TABLE "media_assets"
  ADD CONSTRAINT "media_assets_created_by_admin_id_fkey"
  FOREIGN KEY ("created_by_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "media_translations"
  ADD CONSTRAINT "media_translations_media_asset_id_fkey"
  FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_avatar_media_id_fkey"
  FOREIGN KEY ("avatar_media_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_resume_media_id_fkey"
  FOREIGN KEY ("resume_media_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "profile_translations"
  ADD CONSTRAINT "profile_translations_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "social_links"
  ADD CONSTRAINT "social_links_profile_id_fkey"
  FOREIGN KEY ("profile_id") REFERENCES "profiles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects"
  ADD CONSTRAINT "projects_cover_media_id_fkey"
  FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "project_translations"
  ADD CONSTRAINT "project_translations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_technologies"
  ADD CONSTRAINT "project_technologies_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_technologies"
  ADD CONSTRAINT "project_technologies_technology_id_fkey"
  FOREIGN KEY ("technology_id") REFERENCES "technologies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tag_translations"
  ADD CONSTRAINT "tag_translations_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_tags"
  ADD CONSTRAINT "project_tags_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_tags"
  ADD CONSTRAINT "project_tags_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_media"
  ADD CONSTRAINT "project_media_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_media"
  ADD CONSTRAINT "project_media_media_asset_id_fkey"
  FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "articles"
  ADD CONSTRAINT "articles_author_profile_id_fkey"
  FOREIGN KEY ("author_profile_id") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "articles"
  ADD CONSTRAINT "articles_cover_media_id_fkey"
  FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "article_translations"
  ADD CONSTRAINT "article_translations_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_tags"
  ADD CONSTRAINT "article_tags_article_id_fkey"
  FOREIGN KEY ("article_id") REFERENCES "articles"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "article_tags"
  ADD CONSTRAINT "article_tags_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news"
  ADD CONSTRAINT "news_cover_media_id_fkey"
  FOREIGN KEY ("cover_media_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "news_translations"
  ADD CONSTRAINT "news_translations_news_id_fkey"
  FOREIGN KEY ("news_id") REFERENCES "news"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_tags"
  ADD CONSTRAINT "news_tags_news_id_fkey"
  FOREIGN KEY ("news_id") REFERENCES "news"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "news_tags"
  ADD CONSTRAINT "news_tags_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "newsletter_tokens"
  ADD CONSTRAINT "newsletter_tokens_subscriber_id_fkey"
  FOREIGN KEY ("subscriber_id") REFERENCES "newsletter_subscribers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "newsletter_issue_translations"
  ADD CONSTRAINT "newsletter_issue_translations_issue_id_fkey"
  FOREIGN KEY ("issue_id") REFERENCES "newsletter_issues"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "audit_logs"
  ADD CONSTRAINT "audit_logs_actor_admin_id_fkey"
  FOREIGN KEY ("actor_admin_id") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
