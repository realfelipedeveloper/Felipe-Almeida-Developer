import { BadRequestException } from '@nestjs/common';
import {
  AdminRole,
  NewsletterSubscriberStatus,
  Prisma,
  PrismaClient,
  PublicationStatus,
} from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { PrismaService } from '../src/infra/prisma/prisma.service';
import type { CacheService } from '../src/infra/redis/cache.service';
import { AdminContentService } from '../src/modules/admin/application/admin-content.service';
import { AdminEngagementService } from '../src/modules/admin/application/admin-engagement.service';
import { PrismaArticlePublicReadRepository } from '../src/modules/articles/infrastructure/prisma-article-public-read.repository';
import type { AuthenticatedAdmin } from '../src/modules/auth/application/auth.types';
import { PrismaNewsPublicReadRepository } from '../src/modules/news/infrastructure/prisma-news-public-read.repository';
import type { RichTextSanitizer } from '../src/shared/application/rich-text-sanitizer';

describe('administração concorrente (PostgreSQL real)', () => {
  jest.setTimeout(120_000);
  const require = createRequire(__filename);
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let content: AdminContentService;
  let engagement: AdminEngagementService;
  let admin: AuthenticatedAdmin;

  beforeAll(async () => {
    process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    const databaseUrl = container.getConnectionUri();
    const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
    execFileSync(
      process.execPath,
      [prismaCli, 'migrate', 'deploy', '--schema', 'prisma/schema.prisma'],
      { env: { ...process.env, DATABASE_URL: databaseUrl }, cwd: join(__dirname, '..') },
    );
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    const sanitizer: RichTextSanitizer = {
      sanitize: (value) => value,
      hasMeaningfulContent: (value) => Boolean(value.trim()),
    };
    content = new AdminContentService(
      prisma as unknown as PrismaService,
      { invalidateByPrefix: async () => undefined } as unknown as CacheService,
      sanitizer,
    );
    engagement = new AdminEngagementService(prisma as unknown as PrismaService, sanitizer);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE audit_logs, outbox_events, newsletter_issue_translations, newsletter_issues, newsletter_tokens, newsletter_subscribers, article_translations, article_tags, articles, news_translations, news_tags, news, admin_users CASCADE',
    );
    const row = await prisma.adminUser.create({
      data: {
        email: 'admin@example.com',
        passwordHash: 'hash-de-teste',
        role: AdminRole.ADMIN,
        active: true,
      },
    });
    admin = {
      id: row.id,
      email: row.email,
      role: row.role,
      sessionId: 'sessao-e2e',
      mustChangePassword: false,
    };
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('não reativa inscrição quando unsubscribe concorrente vence o lock do titular', async () => {
    const subscriber = await prisma.newsletterSubscriber.create({
      data: {
        email: 'titular@example.com',
        locale: 'PT_BR',
        status: NewsletterSubscriberStatus.ACTIVE,
        confirmedAt: new Date(),
      },
    });
    const subjectKey = createHmac('sha256', process.env.PRIVACY_HASH_SECRET!)
      .update(subscriber.email)
      .digest('hex');
    let signalLocked!: () => void;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    let release!: () => void;
    const mayFinish = new Promise<void>((resolve) => (release = resolve));
    const unsubscribe = prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${subjectKey}, 0))
      `);
      signalLocked();
      await mayFinish;
      await tx.newsletterSubscriber.update({
        where: { id: subscriber.id },
        data: { status: NewsletterSubscriberStatus.UNSUBSCRIBED, unsubscribedAt: new Date() },
      });
    });
    await locked;
    const adminAttempt = engagement.updateSubscriberStatus(
      subscriber.id,
      NewsletterSubscriberStatus.ACTIVE,
      admin,
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    release();
    await unsubscribe;

    await expect(adminAttempt).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      prisma.newsletterSubscriber.findUniqueOrThrow({ where: { id: subscriber.id } }),
    ).resolves.toMatchObject({ status: NewsletterSubscriberStatus.UNSUBSCRIBED });
  });

  it('emite um único evento na publicação concorrente e nunca republica', async () => {
    const article = await prisma.article.create({ data: { publicationStatus: 'DRAFT' } });
    const issue = await prisma.newsletterIssue.create({ data: { publicationStatus: 'DRAFT' } });
    const articleBody = {
      publicationStatus: PublicationStatus.PUBLISHED,
      authorProfileId: null,
      coverMediaId: null,
      readingTimeMinutes: 5,
      scheduledAt: null,
      publishedAt: null,
      tagIds: [],
      translations: [
        {
          locale: 'pt-BR' as const,
          title: 'Concorrência',
          slug: 'concorrencia',
          summary: 'Resumo',
          bodyHtml: '<p>Conteúdo</p>',
        },
      ],
    };
    const issueBody = {
      publicationStatus: PublicationStatus.PUBLISHED,
      scheduledAt: null,
      publishedAt: null,
      translations: [
        {
          locale: 'pt-BR' as const,
          subject: 'Edição concorrente',
          previewText: 'Resumo',
          bodyHtml: '<p>Conteúdo</p>',
        },
      ],
    };

    await Promise.all([
      content.updateArticle(article.id, articleBody, admin),
      content.updateArticle(article.id, articleBody, admin),
      engagement.updateIssue(issue.id, issueBody, admin),
      engagement.updateIssue(issue.id, issueBody, admin),
    ]);
    await content.updateArticle(
      article.id,
      { ...articleBody, publicationStatus: PublicationStatus.ARCHIVED },
      admin,
    );
    await content.updateArticle(article.id, articleBody, admin);
    await engagement.updateIssue(
      issue.id,
      { ...issueBody, publicationStatus: PublicationStatus.ARCHIVED },
      admin,
    );
    await engagement.updateIssue(issue.id, issueBody, admin);

    const [storedArticle, storedIssue, articleEvents, issueEvents] = await Promise.all([
      prisma.article.findUniqueOrThrow({ where: { id: article.id } }),
      prisma.newsletterIssue.findUniqueOrThrow({ where: { id: issue.id } }),
      prisma.outboxEvent.count({
        where: { eventName: 'article.published', aggregateId: article.id },
      }),
      prisma.outboxEvent.count({
        where: { eventName: 'newsletter.issue.published', aggregateId: issue.id },
      }),
    ]);
    expect(storedArticle.publishedAt).toBeTruthy();
    expect(storedIssue.publishedAt).toBeTruthy();
    expect(storedArticle.publishedEventAt).toBeTruthy();
    expect(storedIssue.publishedEventAt).toBeTruthy();
    expect(articleEvents).toBe(1);
    expect(issueEvents).toBe(1);
  });

  it('preserva data editorial do rascunho e publica exatamente uma vez', async () => {
    const draftArticle = {
      publicationStatus: PublicationStatus.DRAFT,
      authorProfileId: null,
      coverMediaId: null,
      readingTimeMinutes: 5,
      scheduledAt: null,
      publishedAt: new Date().toISOString(),
      tagIds: [],
      translations: [
        {
          locale: 'pt-BR' as const,
          title: 'Rascunho',
          slug: 'rascunho-com-data',
          summary: 'Resumo',
          bodyHtml: '<p>Conteúdo</p>',
        },
      ],
    };
    const draftIssue = {
      publicationStatus: PublicationStatus.DRAFT,
      scheduledAt: null,
      publishedAt: new Date().toISOString(),
      translations: [
        {
          locale: 'pt-BR' as const,
          subject: 'Rascunho com data',
          previewText: 'Resumo',
          bodyHtml: '<p>Conteúdo</p>',
        },
      ],
    };
    const [article, issue] = await Promise.all([
      content.createArticle(draftArticle, admin),
      engagement.createIssue(draftIssue, admin),
    ]);
    expect(article.publishedAt).toBeTruthy();
    expect(issue.publishedAt).toBeTruthy();
    expect(article.publishedEventAt).toBeNull();
    expect(issue.publishedEventAt).toBeNull();

    await Promise.all([
      content.updateArticle(
        article.id,
        { ...draftArticle, publicationStatus: PublicationStatus.PUBLISHED },
        admin,
      ),
      engagement.updateIssue(
        issue.id,
        { ...draftIssue, publicationStatus: PublicationStatus.PUBLISHED },
        admin,
      ),
    ]);

    expect(
      await prisma.outboxEvent.count({
        where: { eventName: 'article.published', aggregateId: article.id },
      }),
    ).toBe(1);
    expect(
      await prisma.outboxEvent.count({
        where: { eventName: 'newsletter.issue.published', aggregateId: issue.id },
      }),
    ).toBe(1);
  });

  it('aplica a mesma janela pública em listas e detalhes de artigos e notícias', async () => {
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const cases = [
      {
        slug: 'imediato',
        status: PublicationStatus.PUBLISHED,
        publishedAt: past,
        scheduledAt: null,
      },
      {
        slug: 'agendado-passado',
        status: PublicationStatus.PUBLISHED,
        publishedAt: past,
        scheduledAt: past,
      },
      {
        slug: 'agendado-futuro',
        status: PublicationStatus.PUBLISHED,
        publishedAt: past,
        scheduledAt: future,
      },
      {
        slug: 'publicacao-futura',
        status: PublicationStatus.PUBLISHED,
        publishedAt: future,
        scheduledAt: past,
      },
      { slug: 'rascunho', status: PublicationStatus.DRAFT, publishedAt: past, scheduledAt: past },
      {
        slug: 'arquivado',
        status: PublicationStatus.ARCHIVED,
        publishedAt: past,
        scheduledAt: past,
      },
    ];
    for (const item of cases) {
      await prisma.article.create({
        data: {
          publicationStatus: item.status,
          publishedAt: item.publishedAt,
          scheduledAt: item.scheduledAt,
          translations: {
            create: {
              locale: 'PT_BR',
              title: item.slug,
              slug: `artigo-${item.slug}`,
              summary: 'Resumo',
              bodyHtml: '<p>Conteúdo</p>',
            },
          },
        },
      });
      await prisma.news.create({
        data: {
          publicationStatus: item.status,
          publishedAt: item.publishedAt,
          scheduledAt: item.scheduledAt,
          translations: {
            create: {
              locale: 'PT_BR',
              title: item.slug,
              slug: `noticia-${item.slug}`,
              summary: 'Resumo',
              contentHtml: '<p>Conteúdo</p>',
            },
          },
        },
      });
    }
    const articles = new PrismaArticlePublicReadRepository(prisma as unknown as PrismaService);
    const news = new PrismaNewsPublicReadRepository(prisma as unknown as PrismaService);
    const filters = { locale: 'pt-BR' as const, page: 1, limit: 20 };

    await expect(articles.listPublished(filters)).resolves.toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ slug: 'artigo-imediato' }),
        expect.objectContaining({ slug: 'artigo-agendado-passado' }),
      ]),
      total: 2,
    });
    await expect(news.listPublished(filters)).resolves.toMatchObject({
      data: expect.arrayContaining([
        expect.objectContaining({ slug: 'noticia-imediato' }),
        expect.objectContaining({ slug: 'noticia-agendado-passado' }),
      ]),
      total: 2,
    });
    for (const hidden of ['agendado-futuro', 'publicacao-futura', 'rascunho', 'arquivado']) {
      await expect(articles.findPublishedBySlug('pt-BR', `artigo-${hidden}`)).resolves.toBeNull();
      await expect(news.findPublishedBySlug('pt-BR', `noticia-${hidden}`)).resolves.toBeNull();
    }
    await expect(articles.findPublishedBySlug('pt-BR', 'artigo-imediato')).resolves.toBeTruthy();
    await expect(news.findPublishedBySlug('pt-BR', 'noticia-imediato')).resolves.toBeTruthy();
  });

  it('torna conteúdo elegível após scheduledAt sem worker ou reinício', async () => {
    const publishedAt = new Date(Date.now() - 60_000);
    const scheduledAt = new Date(Date.now() + 500);
    await prisma.article.create({
      data: {
        publicationStatus: PublicationStatus.PUBLISHED,
        publishedAt,
        scheduledAt,
        translations: {
          create: {
            locale: 'PT_BR',
            title: 'Relógio',
            slug: 'artigo-relogio',
            summary: 'Resumo',
            bodyHtml: '<p>Conteúdo</p>',
          },
        },
      },
    });
    await prisma.news.create({
      data: {
        publicationStatus: PublicationStatus.PUBLISHED,
        publishedAt,
        scheduledAt,
        translations: {
          create: {
            locale: 'PT_BR',
            title: 'Relógio',
            slug: 'noticia-relogio',
            summary: 'Resumo',
            contentHtml: '<p>Conteúdo</p>',
          },
        },
      },
    });
    const articles = new PrismaArticlePublicReadRepository(prisma as unknown as PrismaService);
    const news = new PrismaNewsPublicReadRepository(prisma as unknown as PrismaService);

    await expect(articles.findPublishedBySlug('pt-BR', 'artigo-relogio')).resolves.toBeNull();
    await expect(news.findPublishedBySlug('pt-BR', 'noticia-relogio')).resolves.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 650));
    await expect(articles.findPublishedBySlug('pt-BR', 'artigo-relogio')).resolves.toBeTruthy();
    await expect(news.findPublishedBySlug('pt-BR', 'noticia-relogio')).resolves.toBeTruthy();
  });
});
