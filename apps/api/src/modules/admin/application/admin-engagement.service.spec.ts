import { BadRequestException } from '@nestjs/common';
import { NewsletterSubscriberStatus } from '@prisma/client';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { RichTextSanitizer } from '../../../shared/application/rich-text-sanitizer';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import type { UpsertNewsletterIssueAdminDto } from '../presentation/dto/admin-engagement.dto';
import { AdminEngagementService } from './admin-engagement.service';

describe('AdminEngagementService - edições da newsletter', () => {
  beforeEach(() => {
    process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
  });

  const admin = {
    id: '9e7b7a71-dfc8-4f04-b112-967b50ea81e4',
    email: 'admin@example.com',
    role: 'ADMIN',
  } as AuthenticatedAdmin;

  const issueBody = (bodyHtml: string): UpsertNewsletterIssueAdminDto => ({
    publicationStatus: 'PUBLISHED',
    scheduledAt: null,
    publishedAt: null,
    translations: [
      {
        locale: 'pt-BR',
        subject: 'Edição de outubro',
        previewText: 'Resumo da edição',
        bodyHtml,
      },
    ],
  });

  function setup(currentStatus: 'DRAFT' | 'PUBLISHED' = 'DRAFT') {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'issue-id',
          publishedAt: currentStatus === 'PUBLISHED' ? new Date('2026-10-01T12:00:00Z') : null,
          acquired: 1,
        },
      ]),
      newsletterIssue: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'issue-id',
            publicationStatus: data.publicationStatus,
            scheduledAt: data.scheduledAt,
            publishedAt: data.publishedAt,
            publishedEventAt: null,
          }),
        ),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'issue-id',
            publicationStatus: data.publicationStatus ?? currentStatus,
            scheduledAt: data.scheduledAt ?? null,
            publishedAt: data.publishedAt ?? new Date('2026-10-01T12:00:00Z'),
            publishedEventAt:
              currentStatus === 'PUBLISHED' || data.publishedEventAt
                ? new Date('2026-10-01T12:00:00Z')
                : null,
          }),
        ),
        delete: jest.fn().mockResolvedValue({ id: 'issue-id' }),
      },
      newsletterIssueTranslation: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
      newsletterSubscriber: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'subscriber-id',
          email: 'titular@example.com',
          status: NewsletterSubscriberStatus.UNSUBSCRIBED,
          confirmedAt: new Date(),
          unsubscribedAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      outboxEvent: { create: jest.fn().mockResolvedValue({}) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn(async (operation: (client: typeof tx) => unknown) => operation(tx)),
      newsletterIssue: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockImplementation(({ select }: { select?: unknown }) =>
          select
            ? Promise.resolve({ id: 'issue-id', publicationStatus: currentStatus })
            : Promise.resolve({
                id: 'issue-id',
                publicationStatus: currentStatus,
                translations: [],
              }),
        ),
      },
      newsletterSubscriber: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'subscriber-id',
          status: NewsletterSubscriberStatus.UNSUBSCRIBED,
          confirmedAt: new Date(),
          unsubscribedAt: new Date(),
        }),
      },
    } as unknown as PrismaService;
    const sanitizer: RichTextSanitizer = {
      sanitize: jest.fn().mockReturnValue('<p>Conteúdo seguro</p>'),
      hasMeaningfulContent: jest.fn().mockReturnValue(true),
    };

    return {
      tx,
      sanitizer,
      service: new AdminEngagementService(prisma, sanitizer),
    };
  }

  it('sanitiza e publica a edição com evento mínimo na mesma transação', async () => {
    const { service, sanitizer, tx } = setup();

    await service.createIssue(issueBody('<img src=x onerror=alert(1)><p>Conteúdo</p>'), admin);

    expect(sanitizer.sanitize).toHaveBeenCalled();
    expect(tx.newsletterIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publicationStatus: 'PUBLISHED',
        translations: {
          create: [expect.objectContaining({ bodyHtml: '<p>Conteúdo seguro</p>' })],
        },
      }),
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'newsletter.issue.published',
        aggregateType: 'NewsletterIssue',
        aggregateId: 'issue-id',
        payload: { issueId: 'issue-id' },
      }),
    });
  });

  it('não republica evento ao editar uma edição que já estava publicada', async () => {
    const { service, tx } = setup('PUBLISHED');

    await service.updateIssue('issue-id', issueBody('<p>Atualizado</p>'), admin);

    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('preserva publishedAt editorial em rascunho e emite evento ao autorizar publicação', async () => {
    const { service, tx } = setup();
    const draft = issueBody('<p>Rascunho</p>');
    draft.publicationStatus = 'DRAFT';
    draft.publishedAt = '2026-10-01T12:00:00.000Z';

    await service.createIssue(draft, admin);
    expect(tx.newsletterIssue.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        publicationStatus: 'DRAFT',
        publishedAt: new Date('2026-10-01T12:00:00.000Z'),
      }),
    });
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();

    await service.updateIssue('issue-id', issueBody('<p>Publicada</p>'), admin);
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
  });

  it('retém campanha quando PUBLISHED possui agendamento futuro', async () => {
    const { service, tx } = setup();
    const body = issueBody('<p>Conteúdo</p>');
    body.scheduledAt = '2999-01-01T00:00:00.000Z';

    await service.createIssue(body, admin);
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('não permite ativação administrativa sem double opt-in do titular', async () => {
    const { service } = setup();

    await expect(
      service.updateSubscriberStatus('subscriber-id', NewsletterSubscriberStatus.ACTIVE, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
