UPDATE "profile_translations"
SET "bio" = CASE "locale"
  WHEN 'en' THEN 'Throughout my professional path I have helped build, maintain and evolve production systems, including legacy applications with established business rules and modern projects based on APIs and reactive interfaces. The focus remains on understanding the problem before choosing the technology.'
  WHEN 'es' THEN 'A lo largo de mi trayectoria profesional participé en la construcción, mantenimiento y evolución de sistemas en producción, incluyendo aplicaciones legadas con reglas de negocio consolidadas y proyectos modernos basados en APIs e interfaces reactivas. El foco sigue siendo entender el problema antes de elegir la tecnología.'
  ELSE 'Ao longo da trajetória profissional, participei da construção, manutenção e evolução de sistemas em produção, incluindo aplicações legadas com regras de negócio consolidadas e projetos modernos baseados em APIs e interfaces reativas. O foco permanece em entender o problema antes de escolher a tecnologia.'
END,
"updated_at" = CURRENT_TIMESTAMP
WHERE UPPER(TRIM("bio")) LIKE 'TODO:%';
