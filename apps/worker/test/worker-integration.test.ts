import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { after, before, test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RabbitMQContainer, type StartedRabbitMQContainer } from '@testcontainers/rabbitmq';
import { EVENTS_EXCHANGE, RabbitConnection } from '../src/infra/rabbitmq.js';
import { AuditConsumer } from '../src/services/audit-consumer.js';
import { OutboxDispatcher } from '../src/services/outbox-dispatcher.js';

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
  { timeout: 20_000 },
  async () => {
    const eventId = randomUUID();
    const correlationId = randomUUID();
    const channel = await rabbit.connect();
    const observer = await channel.assertQueue('', { exclusive: true, autoDelete: true });
    await channel.bindQueue(observer.queue, EVENTS_EXCHANGE, 'integration.test');

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

    const observed = await waitForMessage(channel, observer.queue);
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

    channel.publish(EVENTS_EXCHANGE, 'integration.test', observed.content, {
      persistent: true,
      messageId: eventId,
      correlationId,
    });
    await waitFor(async () => {
      const queue = await channel.checkQueue('fad.events.audit');
      return queue.messageCount === 0;
    });
    assert.equal(await prisma.processedEvent.count({ where: { eventId, consumer: CONSUMER } }), 1);
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
  assert.match(String(deadLetter.properties.headers?.['x-fad-dead-letter-reason']), /JSON/);
  assert.equal(deadLetter.fields.routingKey, 'integration.dlq');
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

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 7_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Condição não atendida em ${timeoutMs}ms.`);
}
