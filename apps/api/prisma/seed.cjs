const { PrismaClient, Locale, MediaKind, MediaStorageProvider } = require('@prisma/client');

const prisma = new PrismaClient();

const PROFILE_TRANSLATIONS = [
  {
    locale: Locale.PT_BR,
    fullName: 'Felipe Almeida',
    headline: 'Engenheiro de Software e Desenvolvedor Full Stack',
    summary: 'TODO: revise este resumo público no painel administrativo.',
    bio: 'TODO: escreva aqui sua biografia profissional completa em pt-BR.',
    seoTitle: 'Felipe Almeida — Engenheiro de Software',
    seoDescription: 'Portfólio profissional de Felipe Almeida. TODO: revise esta descrição antes da publicação em produção.',
  },
  {
    locale: Locale.EN,
    fullName: 'Felipe Almeida',
    headline: 'Software Engineer and Full Stack Developer',
    summary: 'TODO: review this public summary in the admin panel.',
    bio: 'TODO: write your complete professional biography in English.',
    seoTitle: 'Felipe Almeida — Software Engineer',
    seoDescription: 'Professional portfolio of Felipe Almeida. TODO: review this description before production.',
  },
  {
    locale: Locale.ES,
    fullName: 'Felipe Almeida',
    headline: 'Ingeniero de Software y Desarrollador Full Stack',
    summary: 'TODO: revisa este resumen público en el panel administrativo.',
    bio: 'TODO: escribe aquí tu biografía profesional completa en español.',
    seoTitle: 'Felipe Almeida — Ingeniero de Software',
    seoDescription: 'Portafolio profesional de Felipe Almeida. TODO: revisa esta descripción antes de producción.',
  },
];

const TECHNOLOGIES = [
  ['TypeScript', 'typescript', 'language'],
  ['JavaScript', 'javascript', 'language'],
  ['Node.js', 'node-js', 'runtime'],
  ['NestJS', 'nestjs', 'backend'],
  ['Next.js', 'next-js', 'frontend'],
  ['React', 'react', 'frontend'],
  ['PHP', 'php', 'language'],
  ['Laravel', 'laravel', 'backend'],
  ['Java', 'java', 'language'],
  ['Spring Boot', 'spring-boot', 'backend'],
  ['PostgreSQL', 'postgresql', 'database'],
  ['MySQL', 'mysql', 'database'],
  ['Redis', 'redis', 'database'],
  ['RabbitMQ', 'rabbitmq', 'messaging'],
  ['Docker', 'docker', 'devops'],
];

const TAGS = [
  {
    key: 'backend',
    translations: [
      [Locale.PT_BR, 'Backend', 'backend'],
      [Locale.EN, 'Backend', 'backend'],
      [Locale.ES, 'Backend', 'backend'],
    ],
  },
  {
    key: 'frontend',
    translations: [
      [Locale.PT_BR, 'Frontend', 'frontend'],
      [Locale.EN, 'Frontend', 'frontend'],
      [Locale.ES, 'Frontend', 'frontend'],
    ],
  },
  {
    key: 'full-stack',
    translations: [
      [Locale.PT_BR, 'Full Stack', 'full-stack'],
      [Locale.EN, 'Full Stack', 'full-stack'],
      [Locale.ES, 'Full Stack', 'full-stack'],
    ],
  },
  {
    key: 'architecture',
    translations: [
      [Locale.PT_BR, 'Arquitetura', 'arquitetura'],
      [Locale.EN, 'Architecture', 'architecture'],
      [Locale.ES, 'Arquitectura', 'arquitectura'],
    ],
  },
  {
    key: 'security',
    translations: [
      [Locale.PT_BR, 'Segurança', 'seguranca'],
      [Locale.EN, 'Security', 'security'],
      [Locale.ES, 'Seguridad', 'seguridad'],
    ],
  },
];

const SEO_PAGES = [
  ['home', '/', 'Felipe Almeida — Engenheiro de Software', 'Portfólio profissional de Felipe Almeida.'],
  ['about', '/sobre', 'Sobre — Felipe Almeida', 'Conheça a trajetória profissional de Felipe Almeida.'],
  ['projects', '/projetos', 'Projetos — Felipe Almeida', 'Projetos e soluções de software desenvolvidos por Felipe Almeida.'],
  ['articles', '/artigos', 'Artigos — Felipe Almeida', 'Artigos sobre desenvolvimento de software e engenharia.'],
  ['news', '/noticias', 'Notícias — Felipe Almeida', 'Atualizações profissionais e dos projetos.'],
  ['contact', '/contato', 'Contato — Felipe Almeida', 'Entre em contato com Felipe Almeida.'],
];

async function seedProfile() {
  const avatar = await prisma.mediaAsset.upsert({
    where: { storageKey: 'public/images/Eu.png' },
    update: {
      kind: MediaKind.IMAGE,
      storageProvider: MediaStorageProvider.LOCAL,
      originalName: 'Eu.png',
      mimeType: 'image/png',
      extension: 'png',
      byteSize: 921671n,
      sha256: '38ea4d5f432953faab3e614654febff5f84f27b613b57fe3264b5e269ad3bd38',
      width: 1170,
      height: 1560,
      deletedAt: null,
    },
    create: {
      kind: MediaKind.IMAGE,
      storageProvider: MediaStorageProvider.LOCAL,
      storageKey: 'public/images/Eu.png',
      originalName: 'Eu.png',
      mimeType: 'image/png',
      extension: 'png',
      byteSize: 921671n,
      sha256: '38ea4d5f432953faab3e614654febff5f84f27b613b57fe3264b5e269ad3bd38',
      width: 1170,
      height: 1560,
    },
  });

  for (const item of [
    [Locale.PT_BR, 'Foto de perfil de Felipe Almeida'],
    [Locale.EN, 'Profile photo of Felipe Almeida'],
    [Locale.ES, 'Foto de perfil de Felipe Almeida'],
  ]) {
    await prisma.mediaTranslation.upsert({
      where: {
        mediaAssetId_locale: {
          mediaAssetId: avatar.id,
          locale: item[0],
        },
      },
      update: { altText: item[1] },
      create: {
        mediaAssetId: avatar.id,
        locale: item[0],
        altText: item[1],
      },
    });
  }

  let profile = await prisma.profile.findFirst({
    orderBy: { createdAt: 'asc' },
  });

  if (!profile) {
    profile = await prisma.profile.create({
      data: {
        publicEmail: null,
        publicLocation: 'TODO',
        availableForWork: true,
        avatarMediaId: avatar.id,
      },
    });
  } else {
    profile = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        avatarMediaId: profile.avatarMediaId ?? avatar.id,
      },
    });
  }

  for (const translation of PROFILE_TRANSLATIONS) {
    await prisma.profileTranslation.upsert({
      where: {
        profileId_locale: {
          profileId: profile.id,
          locale: translation.locale,
        },
      },
      update: {
        fullName: translation.fullName,
        headline: translation.headline,
      },
      create: {
        profileId: profile.id,
        ...translation,
      },
    });
  }

  return profile;
}

async function seedTechnologies() {
  for (const [name, slug, category] of TECHNOLOGIES) {
    await prisma.technology.upsert({
      where: { slug },
      update: { name, category },
      create: { name, slug, category },
    });
  }
}

async function seedTags() {
  for (const tagSeed of TAGS) {
    const tag = await prisma.tag.upsert({
      where: { key: tagSeed.key },
      update: {},
      create: { key: tagSeed.key },
    });

    for (const [locale, label, slug] of tagSeed.translations) {
      await prisma.tagTranslation.upsert({
        where: {
          tagId_locale: {
            tagId: tag.id,
            locale,
          },
        },
        update: { label, slug },
        create: {
          tagId: tag.id,
          locale,
          label,
          slug,
        },
      });
    }
  }
}

async function seedSeo() {
  for (const [pageKey, canonicalPath, ptTitle, ptDescription] of SEO_PAGES) {
    for (const locale of [Locale.PT_BR, Locale.EN, Locale.ES]) {
      let title = ptTitle;
      let description = ptDescription;

      if (locale !== Locale.PT_BR) {
        const translations = {
          home: {
            [Locale.EN]: ['Felipe Almeida — Software Engineer', 'Professional portfolio of Felipe Almeida.'],
            [Locale.ES]: ['Felipe Almeida — Ingeniero de Software', 'Portafolio profesional de Felipe Almeida.'],
          },
          about: {
            [Locale.EN]: ['About — Felipe Almeida', 'Learn about Felipe Almeida’s professional background.'],
            [Locale.ES]: ['Sobre mí — Felipe Almeida', 'Conoce la trayectoria profesional de Felipe Almeida.'],
          },
          projects: {
            [Locale.EN]: ['Projects — Felipe Almeida', 'Software projects and solutions developed by Felipe Almeida.'],
            [Locale.ES]: ['Proyectos — Felipe Almeida', 'Proyectos y soluciones de software desarrollados por Felipe Almeida.'],
          },
          articles: {
            [Locale.EN]: ['Articles — Felipe Almeida', 'Articles about software development and engineering.'],
            [Locale.ES]: ['Artículos — Felipe Almeida', 'Artículos sobre desarrollo de software e ingeniería.'],
          },
          news: {
            [Locale.EN]: ['News — Felipe Almeida', 'Professional and project updates.'],
            [Locale.ES]: ['Noticias — Felipe Almeida', 'Actualizaciones profesionales y de proyectos.'],
          },
          contact: {
            [Locale.EN]: ['Contact — Felipe Almeida', 'Get in touch with Felipe Almeida.'],
            [Locale.ES]: ['Contacto — Felipe Almeida', 'Ponte en contacto con Felipe Almeida.'],
          },
        };

        [title, description] = translations[pageKey][locale];
      }

      await prisma.seoPageMetadata.upsert({
        where: { pageKey_locale: { pageKey, locale } },
        update: { title, description, canonicalPath },
        create: {
          pageKey,
          locale,
          title,
          description,
          canonicalPath,
        },
      });
    }
  }
}

async function seedSettings() {
  const settings = [
    ['defaultLocale', 'pt-BR'],
    ['supportedLocales', ['pt-BR', 'en', 'es']],
    ['privacyPolicyVersion', 'TODO'],
    ['resumeStatus', 'TODO_UPLOAD_PDF'],
  ];

  for (const [key, value] of settings) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

async function main() {
  console.log('Iniciando seed do Felipe Almeida Developer...');
  const profile = await seedProfile();
  await seedTechnologies();
  await seedTags();
  await seedSeo();
  await seedSettings();

  console.log(`Seed concluído. Perfil base: ${profile.id}`);
  console.log('Campos pessoais/currículo ainda pendentes permanecem marcados como TODO.');
}

main()
  .catch((error) => {
    console.error('Falha ao executar seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
