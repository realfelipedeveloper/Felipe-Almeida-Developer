-- Preserva o idioma escolhido pelo titular para respostas do fluxo LGPD.
ALTER TABLE "privacy_requests"
ADD COLUMN "locale" "Locale" NOT NULL DEFAULT 'pt-BR';

-- Classifica explicitamente se a evidência está ligada a um navegador anônimo
-- ou a uma identidade validada, sem criar vínculo oculto entre ambos.
CREATE TYPE "ConsentSubjectKind" AS ENUM ('ANONYMOUS_BROWSER', 'EMAIL');

ALTER TABLE "consent_records"
ADD COLUMN "subject_kind" "ConsentSubjectKind" NOT NULL DEFAULT 'ANONYMOUS_BROWSER';

CREATE TABLE "privacy_erasure_tombstones" (
  "email_key" VARCHAR(128) NOT NULL,
  "erased_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "privacy_erasure_tombstones_pkey" PRIMARY KEY ("email_key")
);
