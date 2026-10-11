import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import net from 'node:net';
import { afterEach, test } from 'node:test';
import { NewsletterTokenPurpose } from '@prisma/client';
import type { ConsumeMessage } from 'amqplib';
import { parseEventEnvelope } from '../src/domain/event-envelope.js';
import { RabbitConnection } from '../src/infra/rabbitmq.js';
import { ManagementServer } from '../src/infra/management-server.js';
import { validateWorkerSecurityConfig } from '../src/infra/security-config.js';
import { WorkerMetrics } from '../src/infra/worker-metrics.js';
import { EmailSender } from '../src/services/email-sender.js';
import { NotificationConsumer } from '../src/services/notification-consumer.js';
import { PrivacyRetentionService } from '../src/services/privacy-retention.js';
import { OutboxDispatcher } from '../src/services/outbox-dispatcher.js';
import { WhatsAppSender } from '../src/services/whatsapp-sender.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

function message(routingKey = 'contact.submitted'): ConsumeMessage {
  return {
    content: Buffer.from('{"ok":true}'),
    fields: {
      consumerTag: 'test',
      deliveryTag: 1,
      redelivered: false,
      exchange: 'fad.events',
      routingKey,
    },
    properties: {
      contentType: 'application/json',
      contentEncoding: undefined,
      headers: {},
      deliveryMode: 2,
      priority: undefined,
      correlationId: 'corr-1',
      replyTo: undefined,
      expiration: undefined,
      messageId: 'event-1',
      timestamp: Date.now(),
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  };
}

test('RabbitMQ republica retry com contador e confirma a mensagem original', async () => {
  const rabbit = new RabbitConnection();
  const published: unknown[][] = [];
  let acked = false;
  let confirmPublish!: () => void;
  const brokerConfirmation = new Promise<void>((resolve) => (confirmPublish = resolve));

  const fakeChannel = Object.assign(new EventEmitter(), {
    publish: (...args: unknown[]) => {
      published.push(args);
      return true;
    },
    ack: () => {
      acked = true;
    },
    waitForConfirms: () => brokerConfirmation,
    close: async () => undefined,
  });

  (
    rabbit as unknown as {
      channel: typeof fakeChannel | null;
    }
  ).channel = fakeChannel;

  const input = message();
  const retry = rabbit.retry(input, 1);

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(acked, false);
  confirmPublish();
  await retry;

  assert.equal(acked, true);
  assert.equal(published.length, 1);
  assert.equal(published[0]?.[0], 'fad.events.retry');
  assert.equal(published[0]?.[1], 'contact.submitted');

  const options = published[0]?.[3] as {
    expiration?: string;
    headers?: Record<string, unknown>;
  };
  assert.equal(options.expiration, '2000');
  assert.equal(options.headers?.['x-fad-retry-count'], 2);
});

test('RabbitMQ envia mensagens esgotadas para a DLX', async () => {
  const rabbit = new RabbitConnection();
  const published: unknown[][] = [];
  let acked = false;

  const fakeChannel = Object.assign(new EventEmitter(), {
    publish: (...args: unknown[]) => {
      published.push(args);
      return true;
    },
    ack: () => {
      acked = true;
    },
    waitForConfirms: async () => undefined,
    close: async () => undefined,
  });

  (
    rabbit as unknown as {
      channel: typeof fakeChannel | null;
    }
  ).channel = fakeChannel;

  await rabbit.deadLetter(message(), 'falha definitiva');

  assert.equal(acked, true);
  assert.equal(published[0]?.[0], 'fad.events.dlx');

  const options = published[0]?.[3] as {
    headers?: Record<string, unknown>;
  };
  assert.equal(options.headers?.['x-fad-dead-letter-reason'], 'falha definitiva');
});

test('Outbox só marca evento como publicado após confirmação do broker', async () => {
  let confirmPublish!: () => void;
  const brokerConfirmation = new Promise<void>((resolve) => (confirmPublish = resolve));
  const updates: unknown[] = [];
  const prisma = {
    outboxEvent: {
      update: async (input: unknown) => {
        updates.push(input);
      },
    },
  };
  const channel = Object.assign(new EventEmitter(), {
    publish: () => true,
  });
  const rabbit = { confirmPublish: () => brokerConfirmation };
  const dispatcher = new OutboxDispatcher(prisma as never, rabbit as never) as unknown as {
    publish: (channel: unknown, event: Record<string, unknown>) => Promise<void>;
  };
  const publishing = dispatcher.publish(channel, {
    id: '11111111-1111-4111-8111-111111111111',
    eventName: 'integration.test',
    version: 1,
    correlationId: '22222222-2222-4222-8222-222222222222',
    payload: { safe: true },
    occurredAt: new Date('2026-10-11T12:00:00.000Z'),
    attempts: 0,
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(updates.length, 0);
  confirmPublish();
  await publishing;
  assert.equal(updates.length, 1);
});

test('RabbitMQ não confirma a origem quando o broker rejeita a publicação', async () => {
  const rabbit = new RabbitConnection(new WorkerMetrics(), 50);
  let acked = false;
  let closed = false;
  const channel = Object.assign(new EventEmitter(), {
    publish: () => true,
    ack: () => {
      acked = true;
    },
    waitForConfirms: async () => {
      throw new Error('broker nack');
    },
    close: async () => {
      closed = true;
      channel.emit('close');
    },
  });
  const internals = rabbit as unknown as {
    connection: object | null;
    channel: typeof channel | null;
    watchChannel: (current: typeof channel) => void;
  };
  internals.connection = { close: async () => undefined };
  internals.channel = channel;
  internals.watchChannel(channel);

  await assert.rejects(rabbit.retry(message(), 0), /RABBITMQ_PUBLISH_CONFIRMATION_FAILED/);
  assert.equal(acked, false);
  assert.equal(closed, true);
  assert.equal(rabbit.isConnected(), false);
});

test('RabbitMQ abandona espera por drain quando o canal fecha e invalida readiness', async () => {
  const rabbit = new RabbitConnection(new WorkerMetrics(), 50);
  let acked = false;
  const channel = Object.assign(new EventEmitter(), {
    publish: () => false,
    ack: () => {
      acked = true;
    },
    waitForConfirms: async () => undefined,
    close: async () => channel.emit('close'),
  });
  const internals = rabbit as unknown as {
    connection: object | null;
    channel: typeof channel | null;
    watchChannel: (current: typeof channel) => void;
  };
  internals.connection = { close: async () => undefined };
  internals.channel = channel;
  internals.watchChannel(channel);

  const retrying = rabbit.retry(message(), 0);
  await new Promise((resolve) => setImmediate(resolve));
  channel.emit('close');

  await assert.rejects(retrying, /RABBITMQ_PUBLISH_CONFIRMATION_FAILED/);
  assert.equal(acked, false);
  assert.equal(rabbit.isConnected(), false);
});

test('RabbitMQ faz fail-fast sem aguardar close travado e impede falso ready', async () => {
  const fatalCodes: string[] = [];
  const rabbit = new RabbitConnection(new WorkerMetrics(), 50, (code) => fatalCodes.push(code));
  let acked = false;
  const never = new Promise<void>(() => undefined);
  const channel = Object.assign(new EventEmitter(), {
    publish: () => true,
    ack: () => {
      acked = true;
    },
    waitForConfirms: () => never,
    close: () => never,
  });
  const internals = rabbit as unknown as {
    connection: { close: () => Promise<void> } | null;
    channel: typeof channel | null;
    watchChannel: (current: typeof channel) => void;
  };
  internals.connection = { close: () => never };
  internals.channel = channel;
  internals.watchChannel(channel);

  const startedAt = Date.now();
  await assert.rejects(rabbit.retry(message(), 0), /RABBITMQ_PUBLISH_CONFIRMATION_FAILED/);

  assert.ok(Date.now() - startedAt < 150);
  assert.equal(acked, false);
  assert.equal(rabbit.isConnected(), false);
  assert.deepEqual(fatalCodes, ['RABBITMQ_PUBLISH_CONFIRMATION_FAILED']);
  await assert.rejects(rabbit.connect(), /RABBITMQ_RESTART_REQUIRED/);
});

test('RabbitMQ registra os contratos canônicos e mantém aliases legados', async () => {
  const bindings: Array<[string, string, string]> = [];
  const channel = {
    assertExchange: async () => undefined,
    assertQueue: async () => ({ queue: 'test' }),
    bindQueue: async (queue: string, exchange: string, routingKey: string) => {
      bindings.push([queue, exchange, routingKey]);
    },
  };
  const rabbit = new RabbitConnection() as unknown as {
    setupTopology: (channel: unknown) => Promise<void>;
  };

  await rabbit.setupTopology(channel);
  const routingKeys = bindings.map((binding) => binding[2]);
  assert.ok(routingKeys.includes('contact.submitted'));
  assert.ok(routingKeys.includes('newsletter.subscribed'));
  assert.ok(routingKeys.includes('contact.created'));
  assert.ok(routingKeys.includes('newsletter.confirmation.requested'));
});

test('valida envelope de evento sem refletir payload inválido no erro', () => {
  const valid = parseEventEnvelope(
    Buffer.from(
      JSON.stringify({
        eventId: '11111111-1111-4111-8111-111111111111',
        eventName: 'contact.submitted',
        occurredAt: '2026-10-11T12:00:00.000Z',
        correlationId: '22222222-2222-4222-8222-222222222222',
        version: 1,
        payload: { contactMessageId: '33333333-3333-4333-8333-333333333333' },
      }),
    ),
  );
  assert.equal(valid.eventName, 'contact.submitted');

  assert.throws(
    () => parseEventEnvelope(Buffer.from('{"email":"titular@example.com"')),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'INVALID_EVENT_ENVELOPE');
      assert.doesNotMatch(error.message, /titular@example\.com/);
      return true;
    },
  );
  assert.throws(
    () =>
      parseEventEnvelope(
        Buffer.from(
          JSON.stringify({
            eventId: 'não-é-uuid',
            eventName: 'contact.submitted',
            occurredAt: 'ontem',
            correlationId: 'não-é-uuid',
            version: 0,
            payload: [],
          }),
        ),
      ),
    /INVALID_EVENT_ENVELOPE/,
  );
});

test('métricas do worker expõem contadores operacionais sem labels de alta cardinalidade', () => {
  const metrics = new WorkerMetrics();
  metrics.increment('notification_processed');
  metrics.increment('retry_published');
  metrics.increment('retry_published');
  const output = metrics.toPrometheus();

  assert.match(output, /fad_worker_notification_processed_total 1/);
  assert.match(output, /fad_worker_retry_published_total 2/);
  assert.match(output, /fad_worker_dead_letter_published_total 0/);
  assert.doesNotMatch(output, /eventId|correlationId|email/);
});

test('servidor de gestão protege métricas em produção e expõe health isolado', async () => {
  process.env.NODE_ENV = 'production';
  process.env.METRICS_ENABLED = 'true';
  process.env.METRICS_TOKEN = 'm'.repeat(64);
  process.env.WORKER_MANAGEMENT_HOST = '127.0.0.1';
  process.env.WORKER_MANAGEMENT_PORT = '0';
  const server = new ManagementServer(async () => true, new WorkerMetrics());
  await server.start();
  const port = server.getPort();
  assert.ok(port);

  try {
    const live = await fetch(`http://127.0.0.1:${port}/health/live`);
    assert.equal(live.status, 200);
    const ready = await fetch(`http://127.0.0.1:${port}/health/ready`);
    assert.equal(ready.status, 200);
    const unauthorized = await fetch(`http://127.0.0.1:${port}/metrics`);
    assert.equal(unauthorized.status, 401);
    const authorized = await fetch(`http://127.0.0.1:${port}/metrics`, {
      headers: { 'x-metrics-token': 'm'.repeat(64) },
    });
    assert.equal(authorized.status, 200);
    assert.match(await authorized.text(), /fad_worker_uptime_seconds/);
  } finally {
    await server.stop();
  }
});

test('EmailSender usa SendGrid sem acessar SMTP quando configurado', async () => {
  process.env.EMAIL_PROVIDER = 'sendgrid';
  process.env.SENDGRID_API_KEY = 'chave-teste';
  process.env.MAIL_FROM = 'Felipe <no-reply@example.com>';

  let receivedInit: RequestInit | undefined;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    receivedInit = init;
    return new Response(null, { status: 202 });
  }) as typeof fetch;

  const sender = new EmailSender();
  await sender.send({
    to: 'destino@example.com',
    subject: 'Assunto',
    text: 'Texto',
    html: '<p>Texto</p>',
  });

  assert.equal(receivedInit?.method, 'POST');
  assert.equal(
    (receivedInit?.headers as Record<string, string>).Authorization,
    'Bearer chave-teste',
  );
  assert.ok(receivedInit?.signal instanceof AbortSignal);
});

test('EmailSender falha se SendGrid estiver selecionado sem API key', async () => {
  process.env.EMAIL_PROVIDER = 'sendgrid';
  delete process.env.SENDGRID_API_KEY;

  const sender = new EmailSender();

  await assert.rejects(
    sender.send({
      to: 'destino@example.com',
      subject: 'Assunto',
      text: 'Texto',
      html: '<p>Texto</p>',
    }),
    /SENDGRID_API_KEY/,
  );
});

test('EmailSender não propaga corpo potencialmente sensível do SendGrid', async () => {
  process.env.EMAIL_PROVIDER = 'sendgrid';
  process.env.SENDGRID_API_KEY = 'chave-teste';
  process.env.MAIL_FROM = 'Felipe <no-reply@example.com>';
  globalThis.fetch = (async () =>
    new Response('destino@example.com rejeitado pelo provedor', { status: 400 })) as typeof fetch;

  const sender = new EmailSender();
  await assert.rejects(
    sender.send({
      to: 'destino@example.com',
      subject: 'Assunto',
      text: 'Texto',
      html: '<p>Texto</p>',
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'EMAIL_SENDGRID_REJECTED_400');
      assert.doesNotMatch(error.message, /destino@example\.com/);
      return true;
    },
  );
});

test('EmailSender encerra SMTP que silencia durante QUIT dentro do deadline total', async () => {
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_PROVIDER = 'smtp';
  process.env.EMAIL_DELIVERY_TIMEOUT_MS = '100';
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_SECURE = 'false';
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;

  const server = net.createServer((socket) => {
    let buffered = '';
    let receivingData = false;
    socket.setEncoding('utf8');
    socket.write('220 smtp.test ESMTP\r\n');
    socket.on('data', (chunk) => {
      buffered += chunk;
      if (receivingData) {
        if (!buffered.includes('\r\n.\r\n')) return;
        receivingData = false;
        buffered = '';
        socket.write('250 accepted\r\n');
        return;
      }

      const lines = buffered.split('\r\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) {
        if (line.startsWith('EHLO ')) socket.write('250 smtp.test\r\n');
        else if (line.startsWith('MAIL FROM:')) socket.write('250 ok\r\n');
        else if (line.startsWith('RCPT TO:')) socket.write('250 ok\r\n');
        else if (line === 'DATA') {
          receivingData = true;
          socket.write('354 continue\r\n');
        }
        // QUIT é deliberadamente ignorado para provar o deadline total.
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  process.env.SMTP_PORT = String(address.port);

  try {
    await assert.rejects(
      new EmailSender().send({
        to: 'destino@example.com',
        subject: 'Assunto',
        text: 'Texto',
        html: '<p>Texto</p>',
      }),
      /EMAIL_SMTP_TIMEOUT/,
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('NotificationConsumer deriva token determinístico e escapa HTML', () => {
  process.env.NEWSLETTER_TOKEN_SECRET = 'n'.repeat(64);
  process.env.PASSWORD_RESET_TOKEN_SECRET = 'p'.repeat(64);
  process.env.PRIVACY_REQUEST_TOKEN_SECRET = 'r'.repeat(64);
  process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);

  const consumer = new NotificationConsumer(
    {
      privacyRequest: {
        findUnique: async () => ({
          id: '33333333-3333-4333-8333-333333333333',
          email: 'titular@example.com',
          type: 'EXPORT',
          locale: 'PT_BR',
          verificationTokenHash: 'hash',
        }),
      },
    } as never,
    {} as never,
  );

  const internals = consumer as unknown as {
    deriveToken: (tokenId: string, subscriberId: string, purpose: NewsletterTokenPurpose) => string;
    derivePasswordResetToken: (tokenId: string, adminUserId: string) => string;
    derivePrivacyToken: (requestId: string, type: 'EXPORT' | 'DELETE') => string;
    escape: (value: string) => string;
    locale: (value: unknown) => 'pt-BR' | 'en' | 'es';
  };

  const first = internals.deriveToken(
    'token-id',
    'subscriber-id',
    NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
  );
  const second = internals.deriveToken(
    'token-id',
    'subscriber-id',
    NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
  );
  const passwordResetToken = internals.derivePasswordResetToken(
    '11111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
  );
  const privacyToken = internals.derivePrivacyToken(
    '33333333-3333-4333-8333-333333333333',
    'EXPORT',
  );

  assert.equal(first, second);
  assert.match(first, /^token-id\.[A-Za-z0-9_-]+$/);
  assert.match(passwordResetToken, /^11111111-1111-4111-8111-111111111111\.[A-Za-z0-9_-]{43}$/);
  assert.match(privacyToken, /^33333333-3333-4333-8333-333333333333\.[A-Za-z0-9_-]{43}$/);
  assert.equal(
    internals.escape('<script>"x"&</script>'),
    '&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;',
  );
  assert.equal(internals.locale('xx'), 'pt-BR');
});

test('NotificationConsumer envia token LGPD no fragmento e não na query string', async () => {
  process.env.PRIVACY_REQUEST_TOKEN_SECRET = 'r'.repeat(64);
  process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
  process.env.WEB_URL = 'https://portfolio.example.com';
  let sent: { text: string; html: string } | undefined;
  const request = {
    email: 'titular@example.com',
    type: 'EXPORT',
    status: 'PENDING',
    locale: 'PT_BR',
    verificationTokenHash: 'hash',
  };
  const consumer = new NotificationConsumer(
    {
      privacyRequest: {
        findUnique: async () => request,
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $executeRaw: async () => 0,
          $queryRaw: async () => [{ acquired: 1 }],
          privacyRequest: { findUnique: async () => request },
        }),
    } as never,
    {} as never,
  );
  const internals = consumer as unknown as {
    email: { send: (message: { text: string; html: string }) => Promise<void> };
    handlePrivacyVerification: (payload: Record<string, unknown>) => Promise<void>;
  };
  internals.email = {
    send: async (message) => {
      sent = message;
    },
  };

  await internals.handlePrivacyVerification({
    email: 'titular@example.com',
    requestId: '33333333-3333-4333-8333-333333333333',
    type: 'EXPORT',
    locale: 'pt-BR',
  });

  assert.match(sent?.text ?? '', /\/privacidade\/verify#token=/);
  assert.doesNotMatch(sent?.text ?? '', /verify\?token=/);
  assert.match(sent?.html ?? '', /\/privacidade\/verify#token=/);
});

test('NotificationConsumer suprime envio quando o DELETE vence antes da releitura protegida', async () => {
  process.env.PRIVACY_REQUEST_TOKEN_SECRET = 'r'.repeat(64);
  process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
  const request = {
    email: 'titular@example.com',
    type: 'EXPORT',
    status: 'PENDING',
    locale: 'PT_BR',
    verificationTokenHash: 'hash',
  };
  let sent = false;
  const consumer = new NotificationConsumer(
    {
      privacyRequest: { findUnique: async () => request },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          $executeRaw: async () => 0,
          $queryRaw: async () => [{ acquired: 1 }],
          privacyRequest: { findUnique: async () => null },
        }),
    } as never,
    {} as never,
  );
  const internals = consumer as unknown as {
    email: { send: () => Promise<void> };
    handlePrivacyVerification: (payload: Record<string, unknown>) => Promise<void>;
  };
  internals.email = { send: async () => void (sent = true) };

  await internals.handlePrivacyVerification({
    requestId: '33333333-3333-4333-8333-333333333333',
  });
  assert.equal(sent, false);
});

test('NotificationConsumer reduz falhas desconhecidas a um motivo seguro', () => {
  const consumer = new NotificationConsumer({} as never, {} as never);
  const internals = consumer as unknown as {
    safeFailureReason: (error: unknown) => string;
  };

  assert.equal(
    internals.safeFailureReason(new Error('550 destino@example.com bloqueado')),
    'NOTIFICATION_PROCESSING_FAILED',
  );
  assert.equal(
    internals.safeFailureReason(new Error('EMAIL_SENDGRID_REJECTED_400')),
    'EMAIL_SENDGRID_REJECTED_400',
  );
});

test('WhatsApp não realiza chamada externa quando a integração está desabilitada', async () => {
  process.env.WHATSAPP_ENABLED = 'false';
  let called = false;

  globalThis.fetch = (async () => {
    called = true;
    throw new Error('não deveria chamar fetch');
  }) as typeof fetch;

  await new WhatsAppSender().notifyContact({
    name: 'Teste',
    email: 'teste@example.com',
    subject: 'Assunto',
  });

  assert.equal(called, false);
});

test('WhatsApp usa cancelamento explícito e não propaga resposta do provedor', async () => {
  process.env.WHATSAPP_ENABLED = 'true';
  process.env.WHATSAPP_API_URL = 'https://graph.example.com';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id';
  process.env.WHATSAPP_ACCESS_TOKEN = 'token';
  process.env.WHATSAPP_TO_NUMBER = '5511999999999';
  let receivedSignal: AbortSignal | null | undefined;
  globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    receivedSignal = init?.signal;
    return new Response('titular@example.com rejeitado', { status: 429 });
  }) as typeof fetch;

  await assert.rejects(
    new WhatsAppSender().notifyContact({
      name: 'Titular',
      email: 'titular@example.com',
      subject: 'Assunto',
    }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, 'WHATSAPP_REJECTED_429');
      assert.doesNotMatch(error.message, /titular@example\.com/);
      return true;
    },
  );
  assert.ok(receivedSignal instanceof AbortSignal);
});

test('retenção de privacidade executa limpeza idempotente em uma transação', async () => {
  const statements: string[] = [];
  const tx = {
    $executeRawUnsafe: async (sql: string) => {
      statements.push(sql);
      return 0;
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<void>) => callback(tx),
  };

  await new PrivacyRetentionService(prisma as never).runOnce();
  assert.equal(statements.length, 5);
  assert.ok(statements.some((sql) => sql.includes("status = 'EXPIRED'")));
  assert.ok(statements.some((sql) => sql.includes('13 months')));
  assert.ok(statements.some((sql) => sql.includes('privacy_erasure_tombstones')));
});

test('worker exige segredo dedicado e WEB_URL HTTPS em produção', () => {
  process.env.NODE_ENV = 'production';
  process.env.WEB_URL = 'https://portfolio.example.com';
  process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
  delete process.env.PRIVACY_REQUEST_TOKEN_SECRET;
  assert.throws(() => validateWorkerSecurityConfig(), /PRIVACY_REQUEST_TOKEN_SECRET/);

  process.env.PRIVACY_REQUEST_TOKEN_SECRET = 'r'.repeat(64);
  delete process.env.PRIVACY_HASH_SECRET;
  assert.throws(() => validateWorkerSecurityConfig(), /PRIVACY_HASH_SECRET/);

  process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
  process.env.WEB_URL = 'http://portfolio.example.com';
  assert.throws(() => validateWorkerSecurityConfig(), /HTTPS/);

  process.env.WEB_URL = 'https://portfolio.example.com';
  delete process.env.METRICS_TOKEN;
  assert.throws(() => validateWorkerSecurityConfig(), /METRICS_TOKEN/);

  process.env.METRICS_TOKEN = 'm'.repeat(64);
  assert.doesNotThrow(() => validateWorkerSecurityConfig());
});
