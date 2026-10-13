import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { CacheService } from '../../../infra/redis/cache.service';
import type { RichTextSanitizer } from '../../../shared/application/rich-text-sanitizer';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import type {
  UpsertArticleAdminDto,
  UpsertNewsAdminDto,
} from '../presentation/dto/admin-content.dto';
import { AdminContentService } from './admin-content.service';

describe('AdminContentService - HTML rico', () => {
  const admin = {
    id: '9e7b7a71-dfc8-4f04-b112-967b50ea81e4',
    email: 'admin@example.com',
    role: 'ADMIN',
  } as AuthenticatedAdmin;

  const articleBody = (bodyHtml: string) =>
    ({
      publicationStatus: 'PUBLISHED',
      authorProfileId: null,
      coverMediaId: null,
      readingTimeMinutes: 4,
      scheduledAt: null,
      publishedAt: null,
      tagIds: [],
      translations: [
        {
          locale: 'pt-BR',
          title: 'Artigo',
          slug: 'artigo',
          summary: 'Resumo',
          bodyHtml,
        },
      ],
    }) as UpsertArticleAdminDto;

  const newsBody = (contentHtml: string) =>
    ({
      publicationStatus: 'PUBLISHED',
      coverMediaId: null,
      publishedAt: null,
      tagIds: [],
      translations: [
        {
          locale: 'pt-BR',
          title: 'Notícia',
          slug: 'noticia',
          summary: 'Resumo',
          contentHtml,
        },
      ],
    }) as UpsertNewsAdminDto;

  function setup(sanitizedHtml: string) {
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([{ id: 'article-id', publicationStatus: 'DRAFT', publishedAt: null }]),
      article: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'article-id',
            publicationStatus: data.publicationStatus,
            scheduledAt: data.scheduledAt,
            publishedAt: data.publishedAt,
            publishedEventAt: null,
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'article-id',
            publicationStatus: data.publicationStatus ?? 'PUBLISHED',
            scheduledAt: data.scheduledAt ?? null,
            publishedAt: data.publishedAt ?? new Date('2026-10-01T12:00:00Z'),
            publishedEventAt:
              currentPublishedEventAt(data) ??
              (data.publishedEventAt ? new Date('2026-10-01T12:00:00Z') : null),
          }),
        ),
      },
      articleTranslation: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      articleTag: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      news: {
        create: jest.fn().mockResolvedValue({ id: 'news-id' }),
        update: jest.fn().mockResolvedValue({ id: 'news-id' }),
      },
      newsTranslation: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      newsTag: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
      article: {
        findUnique: jest.fn().mockResolvedValue({ id: 'article-id', translations: [], tags: [] }),
      },
      news: {
        findUnique: jest.fn().mockResolvedValue({ id: 'news-id', translations: [], tags: [] }),
      },
    } as unknown as PrismaService;
    const cache = {
      invalidateByPrefix: jest.fn().mockResolvedValue(undefined),
    } as unknown as CacheService;
    const sanitizer: RichTextSanitizer = {
      sanitize: jest.fn().mockReturnValue(sanitizedHtml),
      hasMeaningfulContent: jest.fn((value: string) => Boolean(value.trim())),
    };

    return {
      tx,
      sanitizer,
      service: new AdminContentService(prisma, cache, sanitizer),
    };
  }

  it('sanitiza o corpo do artigo antes de criar', async () => {
    const { service, tx, sanitizer } = setup('<p>Seguro</p>');
    const unsafe = '<p onmouseover="alert(1)">Seguro</p><script>alert(1)</script>';

    await service.createArticle(articleBody(unsafe), admin);

    expect(sanitizer.sanitize).toHaveBeenCalledWith(unsafe);
    expect(tx.article.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        translations: { create: [expect.objectContaining({ bodyHtml: '<p>Seguro</p>' })] },
      }),
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'article.published',
        aggregateType: 'Article',
        aggregateId: 'article-id',
        payload: { articleId: 'article-id' },
      }),
    });
  });

  it('sanitiza o corpo do artigo antes de atualizar', async () => {
    const { service, tx } = setup('<p>Atualizado</p>');

    await service.updateArticle('article-id', articleBody('<p onclick="x">Atualizado</p>'), admin);

    expect(tx.article.update).toHaveBeenCalledWith({
      where: { id: 'article-id' },
      data: expect.objectContaining({
        translations: { create: [expect.objectContaining({ bodyHtml: '<p>Atualizado</p>' })] },
      }),
    });
  });

  it('preserva publishedAt editorial em rascunho e emite evento ao autorizar publicação', async () => {
    const { service, tx } = setup('<p>Seguro</p>');
    const draft = articleBody('<p>Seguro</p>');
    draft.publicationStatus = 'DRAFT';
    draft.publishedAt = '2026-10-01T12:00:00.000Z';

    await service.createArticle(draft, admin);
    expect(tx.article.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publicationStatus: 'DRAFT',
        publishedAt: new Date('2026-10-01T12:00:00.000Z'),
      }),
    });
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();

    const published = articleBody('<p>Seguro</p>');
    await service.updateArticle('article-id', published, admin);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('retém evento quando PUBLISHED possui agendamento futuro', async () => {
    const { service, tx } = setup('<p>Seguro</p>');
    const body = articleBody('<p>Seguro</p>');
    body.scheduledAt = '2999-01-01T00:00:00.000Z';

    await service.createArticle(body, admin);
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('sanitiza o conteúdo da notícia antes de criar', async () => {
    const { service, tx } = setup('<a rel="noopener noreferrer nofollow">Link</a>');

    await service.createNews(newsBody('<a href="javascript:alert(1)">Link</a>'), admin);

    expect(tx.news.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        translations: {
          create: [
            expect.objectContaining({
              contentHtml: '<a rel="noopener noreferrer nofollow">Link</a>',
            }),
          ],
        },
      }),
    });
  });

  it('sanitiza o conteúdo da notícia antes de atualizar', async () => {
    const { service, tx } = setup('<p>Atualizada</p>');

    await service.updateNews('news-id', newsBody('<svg onload="x"></svg><p>Atualizada</p>'), admin);

    expect(tx.news.update).toHaveBeenCalledWith({
      where: { id: 'news-id' },
      data: expect.objectContaining({
        translations: { create: [expect.objectContaining({ contentHtml: '<p>Atualizada</p>' })] },
      }),
    });
  });

  it('rejeita conteúdo obrigatório que fica vazio após sanitização', async () => {
    const { service } = setup('');

    await expect(
      service.createArticle(articleBody('<script>alert(1)</script>'), admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('bloqueia a mídia dentro da transação antes de criar o vínculo', async () => {
    const { service, tx } = setup('<p>Seguro</p>');
    const body = articleBody('<p>Seguro</p>');
    body.coverMediaId = '55ed9830-d52d-47c4-8755-23522d940f53';
    tx.$queryRaw.mockResolvedValue([{ id: '55ed9830-d52d-47c4-8755-23522d940f53', kind: 'IMAGE' }]);

    await service.createArticle(body, admin);

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]!).toBeLessThan(
      tx.article.create.mock.invocationCallOrder[0]!,
    );
  });
});

function currentPublishedEventAt(data: Record<string, unknown>): Date | null {
  return data.publicationStatus === undefined
    ? new Date('2026-10-01T12:00:00Z')
    : null;
}
