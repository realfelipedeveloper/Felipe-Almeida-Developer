ALTER TABLE "news"
ADD COLUMN "scheduled_at" TIMESTAMPTZ(3);

ALTER TABLE "articles"
ADD COLUMN "published_event_at" TIMESTAMPTZ(3);

ALTER TABLE "newsletter_issues"
ADD COLUMN "published_event_at" TIMESTAMPTZ(3);

UPDATE "articles" AS article
SET "published_event_at" = event."occurred_at"
FROM (
  SELECT "aggregate_id", MIN("occurred_at") AS "occurred_at"
  FROM "outbox_events"
  WHERE "event_name" = 'article.published'
  GROUP BY "aggregate_id"
) AS event
WHERE event."aggregate_id" = article."id"::text;

UPDATE "newsletter_issues" AS issue
SET "published_event_at" = event."occurred_at"
FROM (
  SELECT "aggregate_id", MIN("occurred_at") AS "occurred_at"
  FROM "outbox_events"
  WHERE "event_name" = 'newsletter.issue.published'
  GROUP BY "aggregate_id"
) AS event
WHERE event."aggregate_id" = issue."id"::text;

CREATE INDEX "articles_publication_status_published_event_at_scheduled_at_published_at_idx"
ON "articles"("publication_status", "published_event_at", "scheduled_at", "published_at");

CREATE INDEX "news_scheduled_at_idx"
ON "news"("scheduled_at");

CREATE INDEX "news_publication_status_scheduled_at_published_at_idx"
ON "news"("publication_status", "scheduled_at", "published_at");

CREATE INDEX "newsletter_issues_publication_status_published_event_at_schedule_idx"
ON "newsletter_issues"("publication_status", "published_event_at", "scheduled_at", "published_at");
