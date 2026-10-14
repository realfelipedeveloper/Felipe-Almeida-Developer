ALTER TABLE "profile_translations"
ADD COLUMN "about_eyebrow" VARCHAR(80),
ADD COLUMN "about_title" VARCHAR(220),
ADD COLUMN "about_intro" TEXT,
ADD COLUMN "about_principles_title" VARCHAR(180),
ADD COLUMN "about_gallery_title" VARCHAR(180),
ADD COLUMN "about_gallery_text" TEXT,
ADD COLUMN "about_resume_label" VARCHAR(80);

UPDATE "profile_translations"
SET
  "about_eyebrow" = CASE "locale"
    WHEN 'en' THEN 'About'
    WHEN 'es' THEN 'Sobre mí'
    ELSE 'Sobre'
  END,
  "about_title" = CASE "locale"
    WHEN 'en' THEN 'Software engineering beyond implementation.'
    WHEN 'es' THEN 'Ingeniería de software más allá de la implementación.'
    ELSE 'Engenharia de software além da implementação.'
  END,
  "about_intro" = CASE "locale"
    WHEN 'en' THEN 'Experience with web systems and enterprise applications across maintenance, modernization, integrations, architecture and Full Stack development.'
    WHEN 'es' THEN 'Experiencia con sistemas web y aplicaciones corporativas en mantenimiento, modernización, integraciones, arquitectura y desarrollo Full Stack.'
    ELSE 'Atuação em sistemas web e aplicações corporativas, passando por manutenção, modernização, integrações, arquitetura e desenvolvimento Full Stack.'
  END,
  "about_principles_title" = CASE "locale"
    WHEN 'en' THEN 'How I work'
    WHEN 'es' THEN 'Cómo trabajo'
    ELSE 'Como eu trabalho'
  END,
  "about_gallery_title" = CASE "locale"
    WHEN 'en' THEN 'Beyond code'
    WHEN 'es' THEN 'Más allá del código'
    ELSE 'Além do código'
  END,
  "about_gallery_text" = CASE "locale"
    WHEN 'en' THEN 'A few personal records that give the portfolio its own identity.'
    WHEN 'es' THEN 'Algunos registros personales que ayudan a darle identidad propia al portafolio.'
    ELSE 'Alguns registros que ajudam a deixar o portfólio com identidade própria.'
  END,
  "about_resume_label" = CASE "locale"
    WHEN 'en' THEN 'Download résumé'
    WHEN 'es' THEN 'Descargar currículum'
    ELSE 'Baixar currículo'
  END;

ALTER TABLE "profile_translations"
ALTER COLUMN "about_eyebrow" SET NOT NULL,
ALTER COLUMN "about_title" SET NOT NULL,
ALTER COLUMN "about_intro" SET NOT NULL,
ALTER COLUMN "about_principles_title" SET NOT NULL,
ALTER COLUMN "about_gallery_title" SET NOT NULL,
ALTER COLUMN "about_gallery_text" SET NOT NULL,
ALTER COLUMN "about_resume_label" SET NOT NULL;

CREATE TABLE "profile_principles" (
  "id" UUID NOT NULL,
  "profile_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "profile_principles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_principle_translations" (
  "id" UUID NOT NULL,
  "principle_id" UUID NOT NULL,
  "locale" "Locale" NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "text" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "profile_principle_translations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "profile_gallery_media" (
  "profile_id" UUID NOT NULL,
  "media_asset_id" UUID NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "profile_gallery_media_pkey" PRIMARY KEY ("profile_id", "media_asset_id")
);

CREATE INDEX "profile_principles_profile_id_sort_order_idx"
ON "profile_principles"("profile_id", "sort_order");
CREATE UNIQUE INDEX "profile_principle_translations_principle_id_locale_key"
ON "profile_principle_translations"("principle_id", "locale");
CREATE INDEX "profile_principle_translations_locale_idx"
ON "profile_principle_translations"("locale");
CREATE INDEX "profile_gallery_media_media_asset_id_idx"
ON "profile_gallery_media"("media_asset_id");

ALTER TABLE "profile_principles"
ADD CONSTRAINT "profile_principles_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_principle_translations"
ADD CONSTRAINT "profile_principle_translations_principle_id_fkey"
FOREIGN KEY ("principle_id") REFERENCES "profile_principles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_gallery_media"
ADD CONSTRAINT "profile_gallery_media_profile_id_fkey"
FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "profile_gallery_media"
ADD CONSTRAINT "profile_gallery_media_media_asset_id_fkey"
FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH principles("profile_id", "sort_order", "key") AS (
  SELECT "id", 0, 'architecture' FROM "profiles"
  UNION ALL SELECT "id", 1, 'security' FROM "profiles"
  UNION ALL SELECT "id", 2, 'maintenance' FROM "profiles"
)
INSERT INTO "profile_principles" ("id", "profile_id", "sort_order", "updated_at")
SELECT md5("profile_id"::text || ':' || "key")::uuid, "profile_id", "sort_order", CURRENT_TIMESTAMP
FROM principles;

INSERT INTO "profile_principle_translations"
  ("id", "principle_id", "locale", "title", "text", "updated_at")
SELECT
  md5(principle."id"::text || ':' || locale_value::text)::uuid,
  principle."id",
  locale_value,
  CASE
    WHEN principle."sort_order" = 0 AND locale_value = 'en' THEN 'Purposeful architecture'
    WHEN principle."sort_order" = 0 AND locale_value = 'es' THEN 'Arquitectura con propósito'
    WHEN principle."sort_order" = 0 THEN 'Arquitetura com propósito'
    WHEN principle."sort_order" = 1 AND locale_value = 'en' THEN 'Security by design'
    WHEN principle."sort_order" = 1 AND locale_value = 'es' THEN 'Seguridad desde el diseño'
    WHEN principle."sort_order" = 1 THEN 'Segurança desde o desenho'
    WHEN principle."sort_order" = 2 AND locale_value = 'en' THEN 'Code built to evolve'
    WHEN principle."sort_order" = 2 AND locale_value = 'es' THEN 'Código preparado para evolucionar'
    ELSE 'Código para continuar evoluindo'
  END,
  CASE
    WHEN principle."sort_order" = 0 AND locale_value = 'en' THEN 'Complexity must be justified. Modular monoliths, queues, cache or separate services enter when the problem requires them.'
    WHEN principle."sort_order" = 0 AND locale_value = 'es' THEN 'La complejidad debe estar justificada. Monolito modular, colas, caché o servicios separados entran cuando el problema lo requiere.'
    WHEN principle."sort_order" = 0 THEN 'Complexidade precisa ser justificada. Monólito modular, filas, cache ou serviços separados entram quando o problema pede.'
    WHEN principle."sort_order" = 1 AND locale_value = 'en' THEN 'Validation, authorization, rate limiting, observability and secret management are part of the solution, not final polish.'
    WHEN principle."sort_order" = 1 AND locale_value = 'es' THEN 'Validación, autorización, rate limiting, observabilidad y gestión de secretos forman parte de la solución.'
    WHEN principle."sort_order" = 1 THEN 'Validação, autorização, rate limiting, observabilidade e gestão de segredos fazem parte da solução, não do acabamento.'
    WHEN principle."sort_order" = 2 AND locale_value = 'en' THEN 'Clean Code, SOLID, tests, useful documentation and explicit decisions lower the cost of future changes.'
    WHEN principle."sort_order" = 2 AND locale_value = 'es' THEN 'Clean Code, SOLID, pruebas, documentación útil y decisiones explícitas reducen el coste de los próximos cambios.'
    ELSE 'Clean Code, SOLID, testes, documentação útil e decisões explícitas reduzem o custo das próximas mudanças.'
  END,
  CURRENT_TIMESTAMP
FROM "profile_principles" principle
CROSS JOIN unnest(enum_range(NULL::"Locale")) AS locale_value;
