-- Índice alinhado à consulta pública de campanhas publicadas/agendadas.
CREATE INDEX "newsletter_issues_publication_status_scheduled_at_published_at_idx"
ON "newsletter_issues"("publication_status", "scheduled_at", "published_at");
