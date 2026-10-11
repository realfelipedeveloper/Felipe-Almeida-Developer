import assert from 'node:assert/strict';
import net from 'node:net';
import { afterEach, test } from 'node:test';
import { NewsletterTokenPurpose } from '@prisma/client';
import type { ConsumeMessage } from 'amqplib';
import { RabbitConnection } from '../src/infra/rabbitmq.js';
import { validateWorkerSecurityConfig } from '../src/infra/security-config.js';
import { EmailSender } from '../src/services/email-sender.js';
import { NotificationConsumer } from '../src/services/notification-consumer.js';
import { PrivacyRetentionService } from '../src/services/privacy-retention.js';
import { WhatsAppSender } from '../src/services/whatsapp-sender.js';

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

function message(routingKey = 'contact.created'): ConsumeMessage {
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

  const fakeChannel = {
    publish: (...args: unknown[]) => {
      published.push(args);
      return true;
    },
    ack: () => {
      acked = true;
    },
  };

  (
    rabbit as unknown as {
      channel: typeof fakeChannel | null;
    }
  ).channel = fakeChannel;

  const input = message();
  await rabbit.retry(input, 1);

  assert.equal(acked, true);
  assert.equal(published.length, 1);
  assert.equal(published[0]?.[0], 'fad.events.retry');
  assert.equal(published[0]?.[1], 'contact.created');

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

  const fakeChannel = {
    publish: (...args: unknown[]) => {
      published.push(args);
      return true;
    },
    ack: () => {
      acked = true;
    },
  };

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
  assert.doesNotThrow(() => validateWorkerSecurityConfig());
});
