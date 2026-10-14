const { PrismaClient, Locale, MediaKind, MediaStorageProvider } = require('@prisma/client');
const { copyFile, mkdir } = require('node:fs/promises');
const { dirname, resolve } = require('node:path');
const { randomUUID } = require('node:crypto');

const prisma = new PrismaClient();

const PROFILE_TRANSLATIONS = [
  {
    locale: Locale.PT_BR,
    fullName: 'Felipe Almeida',
    headline: 'Engenheiro de Software e Desenvolvedor Full Stack',
    summary: 'TODO: revise este resumo público no painel administrativo.',
    bio: 'TODO: escreva aqui sua biografia profissional completa em pt-BR.',
    aboutEyebrow: 'Sobre',
    aboutTitle: 'Engenharia de software além da implementação.',
    aboutIntro:
      'Atuação em sistemas web e aplicações corporativas, passando por manutenção, modernização, integrações, arquitetura e desenvolvimento Full Stack.',
    aboutPrinciplesTitle: 'Como eu trabalho',
    aboutGalleryTitle: 'Além do código',
    aboutGalleryText: 'Alguns registros que ajudam a deixar o portfólio com identidade própria.',
    aboutResumeLabel: 'Baixar currículo',
    seoTitle: 'Felipe Almeida — Engenheiro de Software',
    seoDescription:
      'Portfólio profissional de Felipe Almeida. TODO: revise esta descrição antes da publicação em produção.',
  },
  {
    locale: Locale.EN,
    fullName: 'Felipe Almeida',
    headline: 'Software Engineer and Full Stack Developer',
    summary: 'TODO: review this public summary in the admin panel.',
    bio: 'TODO: write your complete professional biography in English.',
    aboutEyebrow: 'About',
    aboutTitle: 'Software engineering beyond implementation.',
    aboutIntro:
      'Experience with web systems and enterprise applications across maintenance, modernization, integrations, architecture and Full Stack development.',
    aboutPrinciplesTitle: 'How I work',
    aboutGalleryTitle: 'Beyond code',
    aboutGalleryText: 'A few personal records that give the portfolio its own identity.',
    aboutResumeLabel: 'Download résumé',
    seoTitle: 'Felipe Almeida — Software Engineer',
    seoDescription:
      'Professional portfolio of Felipe Almeida. TODO: review this description before production.',
  },
  {
    locale: Locale.ES,
    fullName: 'Felipe Almeida',
    headline: 'Ingeniero de Software y Desarrollador Full Stack',
    summary: 'TODO: revisa este resumen público en el panel administrativo.',
    bio: 'TODO: escribe aquí tu biografía profesional completa en español.',
    aboutEyebrow: 'Sobre mí',
    aboutTitle: 'Ingeniería de software más allá de la implementación.',
    aboutIntro:
      'Experiencia con sistemas web y aplicaciones corporativas en mantenimiento, modernización, integraciones, arquitectura y desarrollo Full Stack.',
    aboutPrinciplesTitle: 'Cómo trabajo',
    aboutGalleryTitle: 'Más allá del código',
    aboutGalleryText:
      'Algunos registros personales que ayudan a darle identidad propia al portafolio.',
    aboutResumeLabel: 'Descargar currículum',
    seoTitle: 'Felipe Almeida — Ingeniero de Software',
    seoDescription:
      'Portafolio profesional de Felipe Almeida. TODO: revisa esta descripción antes de producción.',
  },
];

const PROFILE_PRINCIPLES = [
  {
    translations: {
      [Locale.PT_BR]: [
        'Arquitetura com propósito',
        'Complexidade precisa ser justificada. Monólito modular, filas, cache ou serviços separados entram quando o problema pede.',
      ],
      [Locale.EN]: [
        'Purposeful architecture',
        'Complexity must be justified. Modular monoliths, queues, cache or separate services enter when the problem requires them.',
      ],
      [Locale.ES]: [
        'Arquitectura con propósito',
        'La complejidad debe estar justificada. Monolito modular, colas, caché o servicios separados entran cuando el problema lo requiere.',
      ],
    },
  },
  {
    translations: {
      [Locale.PT_BR]: [
        'Segurança desde o desenho',
        'Validação, autorização, rate limiting, observabilidade e gestão de segredos fazem parte da solução, não do acabamento.',
      ],
      [Locale.EN]: [
        'Security by design',
        'Validation, authorization, rate limiting, observability and secret management are part of the solution, not final polish.',
      ],
      [Locale.ES]: [
        'Seguridad desde el diseño',
        'Validación, autorización, rate limiting, observabilidad y gestión de secretos forman parte de la solución.',
      ],
    },
  },
  {
    translations: {
      [Locale.PT_BR]: [
        'Código para continuar evoluindo',
        'Clean Code, SOLID, testes, documentação útil e decisões explícitas reduzem o custo das próximas mudanças.',
      ],
      [Locale.EN]: [
        'Code built to evolve',
        'Clean Code, SOLID, tests, useful documentation and explicit decisions lower the cost of future changes.',
      ],
      [Locale.ES]: [
        'Código preparado para evolucionar',
        'Clean Code, SOLID, pruebas, documentación útil y decisiones explícitas reducen el coste de los próximos cambios.',
      ],
    },
  },
];

const PROFILE_GALLERY = [
  ['felipe-01.jpg', 298129, '6743315015e741d3a3d4c95fc3efba1444ff92ffcb90a24bd8a7d52251d1d4f9'],
  ['felipe-02.jpg', 128833, '8e5b54020b5623e6cef8c75c1b9b547fa444e656dd1013b8d92b41454d0688c7'],
  ['felipe-03.jpg', 111882, '6b10d9a4a8427fc1981cfde1ae08f92d6e112d868ebc946ef816ad9cd30656c8'],
  ['felipe-04.jpg', 115709, 'ae4c2da8eab716099c9ec00159312261aa807679ae6a16893a4d91fd307b4b5c'],
  ['felipe-05.jpg', 111806, '40f4ed73c737649705cb4be2e3ed69d0f7d58b2dbc75aeb14446454aa6449b30'],
  ['felipe-06.jpg', 106668, '2e7d0de17394485c0b93da715d0de3aafef36f5833c1ff6149d17ef0ef1d9396'],
  ['felipe-07.jpg', 153260, '5e0240a539c2bd65baf3511925116f8426f6254ded57a881b7f17e791569a8ce'],
  ['felipe-08.jpg', 104196, '94c436b6edc6e0183ad1124cdf8c41018a1272662cf077088b01169ecf822b32'],
  ['felipe-09.jpg', 101698, '080cc336a90a42bda7ecaf958fe8d2a6a85c460627baea5f6cab0c88d476a4e9'],
];

async function copySeedMedia(sourcePath, storageKey) {
  const root = resolve(process.cwd(), process.env.MEDIA_LOCAL_ROOT ?? 'var/media');
  const target = resolve(root, storageKey);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(sourcePath, target);
}

async function seedImage({
  sourcePath,
  legacyStorageKey,
  originalName,
  extension,
  byteSize,
  sha256,
  width = null,
  height = null,
  origin,
}) {
  const existing = await prisma.mediaAsset.findFirst({
    where: {
      OR: [{ storageKey: legacyStorageKey }, { sha256, originalName }],
    },
  });
  const id = existing?.id ?? randomUUID();
  const storageKey = `image/2026/10/${id}.${extension}`;
  await copySeedMedia(sourcePath, storageKey);

  const data = {
    kind: MediaKind.IMAGE,
    storageProvider: MediaStorageProvider.LOCAL,
    storageKey,
    originalName,
    mimeType: extension === 'png' ? 'image/png' : 'image/jpeg',
    extension,
    byteSize: BigInt(byteSize),
    sha256,
    width,
    height,
    deletedAt: null,
    storageReadyAt: new Date(),
    storageDeletedAt: null,
    metadata: { origin },
  };

  return existing
    ? prisma.mediaAsset.update({ where: { id }, data })
    : prisma.mediaAsset.create({ data: { id, ...data } });
}

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
  [
    'home',
    '/',
    'Felipe Almeida — Engenheiro de Software',
    'Portfólio profissional de Felipe Almeida.',
  ],
  [
    'about',
    '/sobre',
    'Sobre — Felipe Almeida',
    'Conheça a trajetória profissional de Felipe Almeida.',
  ],
  [
    'projects',
    '/projetos',
    'Projetos — Felipe Almeida',
    'Projetos e soluções de software desenvolvidos por Felipe Almeida.',
  ],
  [
    'articles',
    '/artigos',
    'Artigos — Felipe Almeida',
    'Artigos sobre desenvolvimento de software e engenharia.',
  ],
  ['news', '/noticias', 'Notícias — Felipe Almeida', 'Atualizações profissionais e dos projetos.'],
  ['contact', '/contato', 'Contato — Felipe Almeida', 'Entre em contato com Felipe Almeida.'],
];

async function seedProfile() {
  const avatar = await seedImage({
    sourcePath: resolve(process.cwd(), '../web/public/images/Eu.png'),
    legacyStorageKey: 'public/images/Eu.png',
    originalName: 'Eu.png',
    extension: 'png',
    byteSize: 921671,
    sha256: '38ea4d5f432953faab3e614654febff5f84f27b613b57fe3264b5e269ad3bd38',
    width: 1170,
    height: 1560,
    origin: 'seed-avatar',
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

  if ((await prisma.profilePrinciple.count({ where: { profileId: profile.id } })) === 0) {
    for (const [sortOrder, principle] of PROFILE_PRINCIPLES.entries()) {
      await prisma.profilePrinciple.create({
        data: {
          profileId: profile.id,
          sortOrder,
          translations: {
            create: Object.entries(principle.translations).map(([locale, [title, text]]) => ({
              locale,
              title,
              text,
            })),
          },
        },
      });
    }
  }

  const hasGallery =
    (await prisma.profileGalleryMedia.count({ where: { profileId: profile.id } })) > 0;
  for (const [sortOrder, [fileName, byteSize, sha256]] of PROFILE_GALLERY.entries()) {
    const media = await seedImage({
      sourcePath: resolve(process.cwd(), `../web/public/images/gallery/${fileName}`),
      legacyStorageKey: `public/images/gallery/${fileName}`,
      originalName: fileName,
      extension: 'jpg',
      byteSize,
      sha256,
      origin: 'seed-gallery',
    });
    if (!hasGallery) {
      await prisma.profileGalleryMedia.create({
        data: { profileId: profile.id, mediaAssetId: media.id, sortOrder },
      });
    }
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
            [Locale.EN]: [
              'Felipe Almeida — Software Engineer',
              'Professional portfolio of Felipe Almeida.',
            ],
            [Locale.ES]: [
              'Felipe Almeida — Ingeniero de Software',
              'Portafolio profesional de Felipe Almeida.',
            ],
          },
          about: {
            [Locale.EN]: [
              'About — Felipe Almeida',
              'Learn about Felipe Almeida’s professional background.',
            ],
            [Locale.ES]: [
              'Sobre mí — Felipe Almeida',
              'Conoce la trayectoria profesional de Felipe Almeida.',
            ],
          },
          projects: {
            [Locale.EN]: [
              'Projects — Felipe Almeida',
              'Software projects and solutions developed by Felipe Almeida.',
            ],
            [Locale.ES]: [
              'Proyectos — Felipe Almeida',
              'Proyectos y soluciones de software desarrollados por Felipe Almeida.',
            ],
          },
          articles: {
            [Locale.EN]: [
              'Articles — Felipe Almeida',
              'Articles about software development and engineering.',
            ],
            [Locale.ES]: [
              'Artículos — Felipe Almeida',
              'Artículos sobre desarrollo de software e ingeniería.',
            ],
          },
          news: {
            [Locale.EN]: ['News — Felipe Almeida', 'Professional and project updates.'],
            [Locale.ES]: [
              'Noticias — Felipe Almeida',
              'Actualizaciones profesionales y de proyectos.',
            ],
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
