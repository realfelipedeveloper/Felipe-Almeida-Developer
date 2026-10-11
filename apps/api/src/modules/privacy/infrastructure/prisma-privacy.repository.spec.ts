import { Locale, PrivacyRequestStatus, PrivacyRequestType } from '@prisma/client';
import { PrismaPrivacyRepository } from './prisma-privacy.repository';

describe('PrismaPrivacyRepository', () => {
  beforeAll(() => {
    process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
  });

  function setup() {
    const tx = {
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
      privacyRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      outboxEvent: { create: jest.fn(), updateMany: jest.fn() },
      contactMessage: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      newsletterSubscriber: {
        findUnique: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn(),
      },
      consentRecord: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn(),
      },
      privacyErasureTombstone: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
    };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      consentRecord: tx.consentRecord,
    };
    return { repository: new PrismaPrivacyRepository(prisma as never), prisma, tx };
  }

  it('persiste solicitação e outbox atomicamente sem token em claro', async () => {
    const { repository, tx, prisma } = setup();
    await repository.createRequest({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'owner@example.com',
      type: 'EXPORT',
      locale: 'en',
      verificationTokenHash: 'a'.repeat(64),
      verificationExpiresAt: new Date('2026-10-11T20:30:00.000Z'),
      correlationId: '22222222-2222-4222-8222-222222222222',
      startedAt: new Date('2026-10-11T20:00:00.000Z'),
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.privacyErasureTombstone.findUnique).toHaveBeenCalled();
    expect(tx.privacyRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ locale: Locale.EN, verificationTokenHash: 'a'.repeat(64) }),
    });
    const outbox = tx.outboxEvent.create.mock.calls[0]![0].data;
    expect(outbox.eventName).toBe('privacy.verification.requested');
    expect(outbox.payload).toEqual({ requestId: '11111111-1111-4111-8111-111111111111' });
    expect(outbox.payload).not.toHaveProperty('token');
  });

  it('descarta solicitação iniciada antes da exclusão concorrente', async () => {
    const { repository, tx } = setup();
    tx.privacyErasureTombstone.findUnique.mockResolvedValue({
      erasedAt: new Date('2026-10-11T20:00:01.000Z'),
    });

    await expect(
      repository.createRequest({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'owner@example.com',
        type: 'EXPORT',
        locale: 'pt-BR',
        verificationTokenHash: 'a'.repeat(64),
        verificationExpiresAt: new Date('2026-10-11T20:30:00.000Z'),
        correlationId: '22222222-2222-4222-8222-222222222222',
        startedAt: new Date('2026-10-11T20:00:00.000Z'),
      }),
    ).resolves.toBe(false);
    expect(tx.privacyRequest.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('exporta somente campos permitidos e conclui dentro do lock transacional', async () => {
    const { repository, tx } = setup();
    const requestId = '11111111-1111-4111-8111-111111111111';
    tx.$queryRaw.mockResolvedValue([{ id: requestId, email: 'owner@example.com' }]);
    tx.privacyRequest.findUnique.mockResolvedValue({ email: 'owner@example.com' });
    tx.privacyRequest.findUnique.mockResolvedValue({
      id: requestId,
      email: 'owner@example.com',
      type: PrivacyRequestType.EXPORT,
      status: PrivacyRequestStatus.PENDING,
      locale: Locale.ES,
      verificationExpiresAt: new Date('2026-10-11T20:30:00.000Z'),
    });

    const result = await repository.withLockedRequest('a'.repeat(64), async (id, unit) => {
      const request = await unit.getRequest(id);
      const data = await unit.exportSubject(request!.email);
      await unit.completeExport(id, new Date('2026-10-11T20:00:00.000Z'));
      return { request, data };
    });

    expect(result?.request?.locale).toBe('es');
    expect(tx.contactMessage.findMany.mock.calls[0]![0].select).not.toHaveProperty('ipHash');
    expect(tx.newsletterSubscriber.findUnique.mock.calls[0]![0].select).not.toHaveProperty(
      'consentIpHash',
    );
    expect(tx.consentRecord.findMany.mock.calls[0]![0].select).not.toHaveProperty('ipHash');
    expect(tx.consentRecord.findMany.mock.calls[0]![0].select).not.toHaveProperty('subjectKey');
    expect(tx.privacyRequest.findMany.mock.calls[0]![0].select).not.toHaveProperty(
      'verificationTokenHash',
    );
    expect(tx.privacyRequest.update).toHaveBeenCalledWith({
      where: { id: requestId },
      data: expect.objectContaining({
        status: PrivacyRequestStatus.COMPLETED,
        verificationTokenHash: null,
      }),
    });
  });

  it('redige outbox e invalida solicitações irmãs ao excluir o titular', async () => {
    const { repository, tx } = setup();
    const requestId = '11111111-1111-4111-8111-111111111111';
    tx.$queryRaw.mockResolvedValue([{ id: requestId, email: 'owner@example.com' }]);
    tx.privacyRequest.findUnique.mockResolvedValue({ email: 'owner@example.com' });

    await repository.withLockedRequest('a'.repeat(64), async (_id, unit) => {
      await unit.deleteSubject({
        requestId,
        email: 'owner@example.com',
        completedAt: new Date('2026-10-11T20:00:00.000Z'),
      });
    });

    expect(tx.newsletterSubscriber.deleteMany).toHaveBeenCalledWith({
      where: { email: 'owner@example.com' },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
  });
});
