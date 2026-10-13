import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import {
  NewsletterSubscriberStatus,
  NewsletterTokenPurpose,
  Prisma,
  PrismaClient,
  PrivacyRequestStatus,
  PrivacyRequestType,
  PublicationStatus,
} from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, type StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import * as amqp from 'amqplib';
import { EVENTS_EXCHANGE, RabbitConnection } from '../src/infra/rabbitmq.js';
import { AuditConsumer } from '../src/services/audit-consumer.js';
import { NotificationConsumer } from '../src/services/notification-consumer.js';
import { OutboxDispatcher } from '../src/services/outbox-dispatcher.js';
import { PublicationScheduler } from '../src/services/publication-scheduler.js';
import { PrismaPrivacyRepository } from '../../api/src/modules/privacy/infrastructure/prisma-privacy.repository.js';

const RETRY_QUEUE = 'fad.events.audit.retry';
const DLQ = 'fad.events.audit.dlq';
const CONSUMER = 'worker.audit.v1';
const require = createRequire(import.meta.url);

let postgres: StartedPostgreSqlContainer;
let rabbitContainer: StartedRabbitMQContainer;
let prisma: PrismaClient;
let rabbit: RabbitConnection;

before(
  async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    rabbitContainer = await new RabbitMQContainer('rabbitmq:3.13-management-alpine')
      .withStartupTimeout(120_000)
      .start();

    const databaseUrl = postgres.getConnectionUri();
    process.env.DATABASE_URL = databaseUrl;
    process.env.RABBITMQ_URL = rabbitContainer.getAmqpUrl();
    process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
    process.env.PRIVACY_REQUEST_TOKEN_SECRET = 'r'.repeat(64);
    process.env.NEWSLETTER_TOKEN_SECRET = 'n'.repeat(64);
    process.env.WEB_URL = 'https://portfolio.example.com';

    const prismaCli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
    execFileSync(
      process.execPath,
      [
        prismaCli,
        'db',
        'push',
        '--schema',
        '../api/prisma/schema.prisma',
        '--skip-generate',
        '--accept-data-loss',
      ],
      {
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      },
    );

    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    rabbit = new RabbitConnection();
    await rabbit.connect();
    await new AuditConsumer(prisma, rabbit).start();
  },
  { timeout: 180_000 },
);

after(async () => {
  await rabbit?.close();
  await prisma?.$disconnect();
  await rabbitContainer?.stop();
  await postgres?.stop();
});

test(
  'publica a outbox com correlationId e processa o evento uma única vez',
  { timeout: 35_000 },
  async () => {
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const publisher = await rabbit.connect();
    const observerConnection = await amqp.connect(rabbitContainer.getAmqpUrl());
    const observerChannel = await observerConnection.createChannel();
    const observer = await observerChannel.assertQueue('', { exclusive: true, autoDelete: true });
    await observerChannel.bindQueue(observer.queue, EVENTS_EXCHANGE, 'integration.test');

    try {
      await prisma.outboxEvent.create({
        data: {
          id: eventId,
          eventName: 'integration.test',
          correlationId,
          payload: { safe: true },
        },
      });

      const dispatcher = new OutboxDispatcher(prisma, rabbit) as unknown as {
        tick(): Promise<void>;
      };
      await dispatcher.tick();

      const observed = await waitForMessage(observerChannel, observer.queue);
      const envelope = JSON.parse(observed.content.toString('utf8')) as {
        eventId: string;
        eventName: string;
        correlationId: string;
        occurredAt: string;
        version: number;
        payload: unknown;
      };
      assert.equal(envelope.eventId, eventId);
      assert.equal(envelope.eventName, 'integration.test');
      assert.equal(envelope.correlationId, correlationId);
      assert.equal(envelope.version, 1);
      assert.deepEqual(envelope.payload, { safe: true });
      assert.equal(new Date(envelope.occurredAt).toISOString(), envelope.occurredAt);

      await waitFor(
        async () =>
          (await prisma.processedEvent.count({ where: { eventId, consumer: CONSUMER } })) === 1,
      );
      const persisted = await prisma.outboxEvent.findUniqueOrThrow({ where: { id: eventId } });
      assert.equal(persisted.attempts, 1);
      assert.ok(persisted.publishedAt);

      publisher.publish(EVENTS_EXCHANGE, 'integration.test', observed.content, {
        persistent: true,
        messageId: eventId,
        correlationId,
      });
      await waitFor(async () => {
        const queue = await publisher.checkQueue('fad.events.audit');
        return queue.messageCount === 0;
      });
      assert.equal(
        await prisma.processedEvent.count({ where: { eventId, consumer: CONSUMER } }),
        1,
      );
    } finally {
      await observerChannel.close();
      await observerConnection.close();
    }
  },
);

test(
  'falha transitória entra na fila de retry com contador incrementado',
  { timeout: 10_000 },
  async () => {
    const channel = await rabbit.connect();
    channel.publish(EVENTS_EXCHANGE, 'integration.retry', Buffer.from('{invalid-json'), {
      persistent: true,
      messageId: randomUUID(),
      headers: { 'x-fad-retry-count': 2 },
    });

    const retried = await waitForMessage(channel, RETRY_QUEUE);
    assert.equal(retried.properties.headers?.['x-fad-retry-count'], 3);
    assert.equal(retried.fields.routingKey, 'integration.retry');
  },
);

test('falha exaurida é enviada para a DLQ com motivo', { timeout: 10_000 }, async () => {
  const channel = await rabbit.connect();
  channel.publish(EVENTS_EXCHANGE, 'integration.dlq', Buffer.from('{invalid-json'), {
    persistent: true,
    messageId: randomUUID(),
    headers: { 'x-fad-retry-count': 5 },
  });

  const deadLetter = await waitForMessage(channel, DLQ);
  assert.equal(
    String(deadLetter.properties.headers?.['x-fad-dead-letter-reason']),
    'INVALID_EVENT_ENVELOPE',
  );
  assert.equal(deadLetter.fields.routingKey, 'integration.dlq');
});

test(
  'evento de notificação duplicado simultâneo produz um único efeito externo',
  { timeout: 15_000 },
  async () => {
    const requestId = randomUUID();
    const eventId = randomUUID();
    const correlationId = randomUUID();
    await prisma.privacyRequest.create({
      data: {
        id: requestId,
        email: `idempotencia-${requestId}@example.com`,
        type: PrivacyRequestType.EXPORT,
        status: PrivacyRequestStatus.PENDING,
        locale: 'PT_BR',
        verificationTokenHash: randomUUID(),
        verificationExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    let sends = 0;
    const consumer = new NotificationConsumer(prisma, rabbit);
    const internals = consumer as unknown as {
      email: { send: () => Promise<void> };
    };
    internals.email = {
      send: async () => {
        sends += 1;
        await new Promise((resolve) => setTimeout(resolve, 150));
      },
    };
    await consumer.start();

    const body = Buffer.from(
      JSON.stringify({
        eventId,
        eventName: 'privacy.verification.requested',
        occurredAt: new Date().toISOString(),
        correlationId,
        version: 1,
        payload: { requestId },
      }),
    );
    const channel = await rabbit.connect();
    channel.publish(EVENTS_EXCHANGE, 'privacy.verification.requested', body, {
      persistent: true,
      messageId: eventId,
      correlationId,
    });
    channel.publish(EVENTS_EXCHANGE, 'privacy.verification.requested', body, {
      persistent: true,
      messageId: eventId,
      correlationId,
    });
    await channel.waitForConfirms();

    await waitFor(
      async () =>
        (await prisma.processedEvent.count({
          where: { eventId, consumer: 'worker.notifications.v1' },
        })) === 1,
    );
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    assert.equal(sends, 1);
  },
);

test(
  'contenção entre eventos do mesmo titular falha antes do envio e o retry produz um único efeito',
  { timeout: 20_000 },
  async () => {
    const requestId = randomUUID();
    const firstEventId = randomUUID();
    const secondEventId = randomUUID();
    const email = `contencao-${requestId}@example.com`;
    await prisma.privacyRequest.create({
      data: {
        id: requestId,
        email,
        type: PrivacyRequestType.EXPORT,
        status: PrivacyRequestStatus.PENDING,
        locale: 'PT_BR',
        verificationTokenHash: randomUUID(),
        verificationExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    let sends = 0;
    let retries = 0;
    let acknowledgements = 0;
    let markFirstSendStarted!: () => void;
    const firstSendStarted = new Promise<void>((resolve) => (markFirstSendStarted = resolve));
    let releaseFirstSend!: () => void;
    const firstSendMayFinish = new Promise<void>((resolve) => (releaseFirstSend = resolve));
    const isolatedRabbit = {
      ack: () => {
        acknowledgements += 1;
      },
      retry: async () => {
        retries += 1;
      },
      deadLetter: async () => undefined,
    };
    const consumer = new NotificationConsumer(prisma, isolatedRabbit as never);
    const internals = consumer as unknown as {
      email: { send: () => Promise<void> };
      handle: (message: amqp.ConsumeMessage) => Promise<void>;
    };
    internals.email = {
      send: async () => {
        sends += 1;
        if (sends === 1) {
          markFirstSendStarted();
          await firstSendMayFinish;
        }
      },
    };

    const notificationMessage = (eventId: string, retryCount = 0): amqp.ConsumeMessage => ({
      content: Buffer.from(
        JSON.stringify({
          eventId,
          eventName: 'privacy.verification.requested',
          occurredAt: new Date().toISOString(),
          correlationId: randomUUID(),
          version: 1,
          payload: { requestId },
        }),
      ),
      fields: {
        consumerTag: 'integration',
        deliveryTag: 1,
        redelivered: retryCount > 0,
        exchange: EVENTS_EXCHANGE,
        routingKey: 'privacy.verification.requested',
      },
      properties: {
        contentType: 'application/json',
        contentEncoding: undefined,
        headers: { 'x-fad-retry-count': retryCount },
        deliveryMode: 2,
        priority: undefined,
        correlationId: randomUUID(),
        replyTo: undefined,
        expiration: undefined,
        messageId: eventId,
        timestamp: Date.now(),
        type: undefined,
        userId: undefined,
        appId: undefined,
        clusterId: undefined,
      },
    });

    const first = internals.handle(notificationMessage(firstEventId));
    await firstSendStarted;
    await internals.handle(notificationMessage(secondEventId));

    assert.equal(sends, 1);
    assert.equal(retries, 1);
    assert.equal(
      await prisma.processedEvent.count({
        where: { eventId: secondEventId, consumer: 'worker.notifications.v1' },
      }),
      0,
    );

    releaseFirstSend();
    await first;
    await internals.handle(notificationMessage(secondEventId, 1));

    assert.equal(sends, 2);
    assert.equal(acknowledgements, 2);
    assert.equal(
      await prisma.processedEvent.count({
        where: { eventId: secondEventId, consumer: 'worker.notifications.v1' },
      }),
      1,
    );
  },
);

test(
  'mantém o lock do titular além de 5s até o efeito externo terminar',
  { timeout: 15_000 },
  async () => {
    const requestId = randomUUID();
    const deleteRequestId = randomUUID();
    const deleteTokenHash = randomUUID();
    const email = `titular-${requestId}@example.com`;
    await prisma.privacyRequest.create({
      data: {
        id: requestId,
        email,
        type: PrivacyRequestType.EXPORT,
        status: PrivacyRequestStatus.PENDING,
        locale: 'PT_BR',
        verificationTokenHash: randomUUID(),
        verificationExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.privacyRequest.create({
      data: {
        id: deleteRequestId,
        email,
        type: PrivacyRequestType.DELETE,
        status: PrivacyRequestStatus.VERIFIED,
        locale: 'PT_BR',
        verificationTokenHash: deleteTokenHash,
        verificationExpiresAt: new Date(Date.now() + 60_000),
      },
    });

    let markSendStarted!: () => void;
    const sendStarted = new Promise<void>((resolve) => (markSendStarted = resolve));
    let finishSend!: () => void;
    const mayFinishSend = new Promise<void>((resolve) => (finishSend = resolve));
    const consumer = new NotificationConsumer(prisma, {} as never);
    const internals = consumer as unknown as {
      email: { send: () => Promise<void> };
      handlePrivacyVerification: (payload: Record<string, unknown>) => Promise<void>;
    };
    internals.email = {
      send: async () => {
        markSendStarted();
        await mayFinishSend;
      },
    };

    const notification = internals.handlePrivacyVerification({ requestId });
    await sendStarted;

    let deletionAcquiredLock = false;
    const privacyRepository = new PrismaPrivacyRepository(prisma as never);
    const deletion = privacyRepository.withLockedRequest(
      deleteTokenHash,
      async (lockedRequestId, unit) => {
        deletionAcquiredLock = true;
        await unit.deleteSubject({
          requestId: lockedRequestId,
          email,
          completedAt: new Date(),
        });
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 5_500));
    assert.equal(deletionAcquiredLock, false);
    finishSend();
    await notification;
    await deletion;
    assert.equal(deletionAcquiredLock, true);
    assert.equal(await prisma.privacyRequest.count({ where: { email } }), 0);
  },
);

test(
  'edição publicada entrega apenas a inscritos ativos e respeita descadastro antes do envio',
  { timeout: 15_000 },
  async () => {
    const issue = await prisma.newsletterIssue.create({
      data: {
        publicationStatus: PublicationStatus.PUBLISHED,
        publishedAt: new Date(),
        translations: {
          create: {
            locale: 'PT_BR',
            subject: 'Edição integrada',
            previewText: 'Prévia segura',
            bodyHtml: '<p>Conteúdo seguro</p>',
          },
        },
      },
    });
    const active = await prisma.newsletterSubscriber.create({
      data: {
        email: `ativo-${issue.id}@example.com`,
        locale: 'PT_BR',
        status: NewsletterSubscriberStatus.ACTIVE,
        confirmedAt: new Date(),
      },
    });
    const unsubscribedBeforeDelivery = await prisma.newsletterSubscriber.create({
      data: {
        email: `descadastra-${issue.id}@example.com`,
        locale: 'PT_BR',
        status: NewsletterSubscriberStatus.ACTIVE,
        confirmedAt: new Date(),
      },
    });
    await prisma.newsletterSubscriber.create({
      data: {
        email: `pendente-${issue.id}@example.com`,
        locale: 'PT_BR',
        status: NewsletterSubscriberStatus.PENDING,
      },
    });
    for (const subscriberId of [active.id, unsubscribedBeforeDelivery.id]) {
      await prisma.newsletterToken.create({
        data: {
          subscriberId,
          purpose: NewsletterTokenPurpose.UNSUBSCRIBE,
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 60_000),
        },
      });
    }

    const isolatedRabbit = {
      ack: () => undefined,
      retry: async () => undefined,
      deadLetter: async () => undefined,
    };
    const sent: Array<{ to: string; text: string; html: string }> = [];
    const consumer = new NotificationConsumer(prisma, isolatedRabbit as never);
    const internals = consumer as unknown as {
      email: {
        send: (message: { to: string; text: string; html: string }) => Promise<void>;
      };
      handle: (message: amqp.ConsumeMessage) => Promise<void>;
    };
    internals.email = {
      send: async (message) => void sent.push(message),
    };
    const toMessage = (
      eventName: string,
      eventId: string,
      payload: Record<string, unknown>,
      correlationId = randomUUID(),
    ): amqp.ConsumeMessage => ({
      content: Buffer.from(
        JSON.stringify({
          eventId,
          eventName,
          occurredAt: new Date().toISOString(),
          correlationId,
          version: 1,
          payload,
        }),
      ),
      fields: {
        consumerTag: 'integration',
        deliveryTag: 1,
        redelivered: false,
        exchange: EVENTS_EXCHANGE,
        routingKey: eventName,
      },
      properties: {
        contentType: 'application/json',
        contentEncoding: undefined,
        headers: {},
        deliveryMode: 2,
        priority: undefined,
        correlationId,
        replyTo: undefined,
        expiration: undefined,
        messageId: eventId,
        timestamp: Date.now(),
        type: undefined,
        userId: undefined,
        appId: undefined,
        clusterId: undefined,
      },
    });

    await internals.handle(
      toMessage('newsletter.issue.published', randomUUID(), { issueId: issue.id }),
    );
    await internals.handle(
      toMessage('newsletter.issue.published', randomUUID(), { issueId: issue.id }),
    );
    const deliveries = await prisma.outboxEvent.findMany({
      where: { eventName: 'newsletter.issue.delivery.requested', aggregateId: issue.id },
      orderBy: { occurredAt: 'asc' },
    });
    assert.equal(deliveries.length, 2);

    await prisma.newsletterSubscriber.update({
      where: { id: unsubscribedBeforeDelivery.id },
      data: { status: NewsletterSubscriberStatus.UNSUBSCRIBED, unsubscribedAt: new Date() },
    });
    for (const delivery of deliveries) {
      await internals.handle(
        toMessage(
          delivery.eventName,
          delivery.id,
          delivery.payload as Record<string, unknown>,
          delivery.correlationId,
        ),
      );
    }

    assert.deepEqual(
      sent.map((message) => message.to),
      [active.email],
    );
    assert.match(sent[0]?.text ?? '', /\/newsletter\/unsubscribe#token=/);
    assert.doesNotMatch(sent[0]?.text ?? '', /unsubscribe\?token=/);
    assert.match(sent[0]?.html ?? '', /\/newsletter\/unsubscribe#token=/);
  },
);

test('fanout em lote permanece idempotente com base volumosa', { timeout: 15_000 }, async () => {
  const issue = await prisma.newsletterIssue.create({
    data: { publicationStatus: PublicationStatus.PUBLISHED, publishedAt: new Date() },
  });
  const suffix = issue.id.slice(0, 8);
  const subscribers = Array.from({ length: 150 }, (_, index) => ({
    id: randomUUID(),
    email: `lote-${suffix}-${index}@example.com`,
    locale: 'PT_BR' as const,
    status: NewsletterSubscriberStatus.ACTIVE,
    confirmedAt: new Date(),
  }));
  await prisma.newsletterSubscriber.createMany({ data: subscribers });
  await prisma.newsletterToken.createMany({
    data: subscribers.map((subscriber) => ({
      subscriberId: subscriber.id,
      purpose: NewsletterTokenPurpose.UNSUBSCRIBE,
      tokenHash: randomUUID(),
      expiresAt: new Date(Date.now() + 60_000),
    })),
  });
  const eligible = await prisma.newsletterSubscriber.count({
    where: {
      status: NewsletterSubscriberStatus.ACTIVE,
      tokens: {
        some: {
          purpose: NewsletterTokenPurpose.UNSUBSCRIBE,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      },
    },
  });
  const consumer = new NotificationConsumer(prisma, {} as never);
  const internals = consumer as unknown as {
    handleIssuePublished: (
      tx: Prisma.TransactionClient,
      payload: Record<string, unknown>,
      correlationId: string,
    ) => Promise<void>;
  };

  await prisma.$transaction((tx) =>
    internals.handleIssuePublished(tx, { issueId: issue.id }, randomUUID()),
  );
  await prisma.$transaction((tx) =>
    internals.handleIssuePublished(tx, { issueId: issue.id }, randomUUID()),
  );

  assert.equal(
    await prisma.outboxEvent.count({
      where: { eventName: 'newsletter.issue.delivery.requested', aggregateId: issue.id },
    }),
    eligible,
  );
});

test('agendador emite evento vencido uma única vez sem controlar visibilidade pública', { timeout: 10_000 }, async () => {
  const scheduledAt = new Date(Date.now() - 60_000);
  const publishedAt = new Date(Date.now() - 120_000);
  const article = await prisma.article.create({
    data: { publicationStatus: PublicationStatus.PUBLISHED, publishedAt, scheduledAt },
  });
  const issue = await prisma.newsletterIssue.create({
    data: { publicationStatus: PublicationStatus.PUBLISHED, publishedAt, scheduledAt },
  });
  const scheduler = new PublicationScheduler(prisma) as unknown as { tick: () => Promise<void> };

  await scheduler.tick();
  await scheduler.tick();

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

  assert.equal(storedArticle.publicationStatus, PublicationStatus.PUBLISHED);
  assert.ok(storedArticle.publishedEventAt);
  assert.equal(storedIssue.publicationStatus, PublicationStatus.PUBLISHED);
  assert.ok(storedIssue.publishedEventAt);
  assert.equal(articleEvents, 1);
  assert.equal(issueEvents, 1);

  await prisma.article.update({
    where: { id: article.id },
    data: { publicationStatus: PublicationStatus.ARCHIVED },
  });
  await prisma.newsletterIssue.update({
    where: { id: issue.id },
    data: { publicationStatus: PublicationStatus.ARCHIVED },
  });
  await prisma.article.update({
    where: { id: article.id },
    data: { publicationStatus: PublicationStatus.DRAFT, scheduledAt },
  });
  await prisma.newsletterIssue.update({
    where: { id: issue.id },
    data: { publicationStatus: PublicationStatus.DRAFT, scheduledAt },
  });
  await scheduler.tick();

  assert.equal(
    (await prisma.article.findUniqueOrThrow({ where: { id: article.id } })).publicationStatus,
    PublicationStatus.DRAFT,
  );
  assert.equal(
    (await prisma.newsletterIssue.findUniqueOrThrow({ where: { id: issue.id } })).publicationStatus,
    PublicationStatus.DRAFT,
  );
  assert.equal(
    await prisma.outboxEvent.count({
      where: { eventName: 'article.published', aggregateId: article.id },
    }),
    1,
  );
  assert.equal(
    await prisma.outboxEvent.count({
      where: { eventName: 'newsletter.issue.published', aggregateId: issue.id },
    }),
    1,
  );
});

async function waitForMessage(
  channel: Awaited<ReturnType<RabbitConnection['connect']>>,
  queue: string,
) {
  let message: Awaited<ReturnType<typeof channel.get>> = false;
  await waitFor(async () => {
    message = await channel.get(queue, { noAck: true });
    return Boolean(message);
  });
  assert.notEqual(message, false);
  return message;
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Condição não atendida em ${timeoutMs}ms.`);
}
