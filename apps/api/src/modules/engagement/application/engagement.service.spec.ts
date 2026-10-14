import type { AppLogger } from '../../../infra/logging/app-logger.service';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { RedisService } from '../../../infra/redis/redis.service';
import { BadRequestException, HttpException } from '@nestjs/common';
import { NewsletterSubscriberStatus, NewsletterTokenPurpose } from '@prisma/client';
import { EngagementService } from './engagement.service';

describe('EngagementService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PRIVACY_HASH_SECRET: 'h'.repeat(64),
      NEWSLETTER_TOKEN_SECRET: 'n'.repeat(64),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function setup() {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ acquired: 1 }]),
      privacyErasureTombstone: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      contactMessage: {
        create: jest.fn().mockResolvedValue({}),
      },
      newsletterSubscriber: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      newsletterToken: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      outboxEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      newsletterSubscriber: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      newsletterToken: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (execute: (client: typeof tx) => Promise<void>) => execute(tx)),
    };
    const redis = {
      connection: {
        incr: jest.fn().mockResolvedValue(1),
        expire: jest.fn().mockResolvedValue(1),
      },
    };
    const logger = {
      child: jest.fn().mockReturnValue({ info: jest.fn(), warn: jest.fn() }),
    };
    const service = new EngagementService(
      prisma as unknown as PrismaService,
      redis as unknown as RedisService,
      logger as unknown as AppLogger,
    );

    return { service, prisma, redis, tx };
  }

  it('persiste contact.submitted com envelope mínimo e correlação propagada', async () => {
    const { service, prisma, tx } = setup();
    const correlationId = '11111111-1111-4111-8111-111111111111';

    await service.submitContact(
      {
        name: 'Pessoa Titular',
        email: ' TITULAR@example.com ',
        subject: 'Contato profissional',
        message: 'Mensagem suficientemente longa.',
        locale: 'pt-BR',
      },
      '203.0.113.10',
      correlationId,
    );

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'contact.submitted',
        correlationId,
        payload: { contactMessageId: expect.any(String) },
      }),
    });
    const event = tx.outboxEvent.create.mock.calls[0]![0].data;
    expect(event.payload).not.toHaveProperty('email');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5_000,
      timeout: 30_000,
    });
  });

  it('persiste newsletter.subscribed sem e-mail nem token em claro', async () => {
    const { service, tx } = setup();

    await service.subscribe(
      { email: ' TITULAR@example.com ', locale: 'en' },
      '203.0.113.10',
      '22222222-2222-4222-8222-222222222222',
    );

    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'newsletter.subscribed',
        correlationId: '22222222-2222-4222-8222-222222222222',
        payload: {
          subscriberId: expect.any(String),
          tokenId: expect.any(String),
          purpose: 'CONFIRM_SUBSCRIPTION',
        },
      }),
    });
    const event = tx.outboxEvent.create.mock.calls[0]![0].data;
    expect(event.payload).not.toHaveProperty('email');
    expect(event.payload).not.toHaveProperty('token');
  });

  it('não persiste formulários capturados pelo honeypot', async () => {
    const { service, prisma } = setup();

    await expect(
      service.submitContact(
        {
          name: 'Bot',
          email: 'bot@example.com',
          subject: 'Spam automatizado',
          message: 'Mensagem suficientemente longa.',
          locale: 'pt-BR',
          website: 'https://spam.example',
        },
        '203.0.113.10',
      ),
    ).resolves.toEqual({ message: 'Mensagem recebida. Retornarei assim que possível.' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('confirma token válido, ativa o titular e cria descadastro', async () => {
    const { service, prisma, tx } = setup();
    prisma.newsletterToken.findUnique.mockResolvedValue({
      id: 'confirmation-token-id',
      subscriberId: 'subscriber-id',
      purpose: NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      subscriber: {
        id: 'subscriber-id',
        email: 'titular@example.com',
        locale: 'EN',
        status: NewsletterSubscriberStatus.PENDING,
        confirmedAt: null,
      },
    });

    await expect(service.confirm('token-valido')).resolves.toEqual({
      message: 'Subscription confirmed successfully.',
    });
    expect(tx.newsletterSubscriber.update).toHaveBeenCalledWith({
      where: { id: 'subscriber-id' },
      data: expect.objectContaining({ status: NewsletterSubscriberStatus.ACTIVE }),
    });
    expect(tx.newsletterToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ purpose: NewsletterTokenPurpose.UNSUBSCRIBE }),
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventName: 'newsletter.confirmed' }),
    });
  });

  it('trata confirmação já consumida como idempotente', async () => {
    const { service, prisma, tx } = setup();
    prisma.newsletterToken.findUnique.mockResolvedValue({
      id: 'confirmation-token-id',
      subscriberId: 'subscriber-id',
      purpose: NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      subscriber: {
        id: 'subscriber-id',
        email: 'titular@example.com',
        locale: 'PT_BR',
        status: NewsletterSubscriberStatus.ACTIVE,
        confirmedAt: new Date(),
      },
    });

    await expect(service.confirm('token-consumido')).resolves.toEqual({
      message: 'Inscrição confirmada com sucesso.',
    });
    expect(tx.newsletterSubscriber.update).not.toHaveBeenCalled();
  });

  it('rejeita confirmação ausente ou expirada', async () => {
    const { service, prisma } = setup();

    await expect(service.confirm('inexistente')).rejects.toBeInstanceOf(BadRequestException);

    prisma.newsletterToken.findUnique.mockResolvedValue({
      purpose: NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
      expiresAt: new Date(Date.now() - 1),
      subscriber: { locale: 'ES' },
    });
    await expect(service.confirm('expirado')).rejects.toThrow('El enlace no es válido');
  });

  it('descadastra imediatamente e publica evento mínimo', async () => {
    const { service, prisma, tx } = setup();
    prisma.newsletterToken.findUnique.mockResolvedValue({
      id: 'unsubscribe-token-id',
      subscriberId: 'subscriber-id',
      purpose: NewsletterTokenPurpose.UNSUBSCRIBE,
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      subscriber: {
        id: 'subscriber-id',
        email: 'titular@example.com',
        locale: 'ES',
      },
    });

    await expect(service.unsubscribe('token-descadastro')).resolves.toEqual({
      message: 'Suscripción cancelada correctamente.',
    });
    expect(tx.newsletterSubscriber.update).toHaveBeenCalledWith({
      where: { id: 'subscriber-id' },
      data: expect.objectContaining({ status: NewsletterSubscriberStatus.UNSUBSCRIBED }),
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventName: 'newsletter.unsubscribed',
        payload: { subscriberId: 'subscriber-id' },
      }),
    });
  });

  it('aplica rate limit sem ocultar indisponibilidade do Redis', async () => {
    const { service, redis, prisma } = setup();
    redis.connection.incr.mockResolvedValue(9);

    await expect(
      service.subscribe(
        { email: 'titular@example.com', locale: 'pt-BR' },
        '203.0.113.10',
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(prisma.$transaction).not.toHaveBeenCalled();

    redis.connection.incr.mockRejectedValue(new Error('Redis indisponível'));
    await expect(
      service.subscribe({ email: 'titular@example.com', locale: 'pt-BR' }, '203.0.113.10'),
    ).resolves.toEqual({ message: 'Confira seu e-mail para confirmar a inscrição.' });
  });
});
