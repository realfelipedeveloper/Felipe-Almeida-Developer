import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { NewsletterTokenPurpose } from '@prisma/client';
import type { ConsumeMessage } from 'amqplib';
import { RabbitConnection } from '../src/infra/rabbitmq.js';
import { EmailSender } from '../src/services/email-sender.js';
import { NotificationConsumer } from '../src/services/notification-consumer.js';
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
  assert.equal(
    options.headers?.['x-fad-dead-letter-reason'],
    'falha definitiva',
  );
});

test('EmailSender usa SendGrid sem acessar SMTP quando configurado', async () => {
  process.env.EMAIL_PROVIDER = 'sendgrid';
  process.env.SENDGRID_API_KEY = 'chave-teste';
  process.env.MAIL_FROM = 'Felipe <no-reply@example.com>';

  let receivedInit: RequestInit | undefined;
  globalThis.fetch = (async (
    _input: string | URL | Request,
    init?: RequestInit,
  ) => {
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

test('NotificationConsumer deriva token determinístico e escapa HTML', () => {
  process.env.NEWSLETTER_TOKEN_SECRET = 'n'.repeat(64);
  process.env.PASSWORD_RESET_TOKEN_SECRET = 'p'.repeat(64);

  const consumer = new NotificationConsumer(
    {} as never,
    {} as never,
  );

  const internals = consumer as unknown as {
    deriveToken: (
      tokenId: string,
      subscriberId: string,
      purpose: NewsletterTokenPurpose,
    ) => string;
    derivePasswordResetToken: (
      tokenId: string,
      adminUserId: string,
    ) => string;
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

  assert.equal(first, second);
  assert.match(first, /^token-id\.[A-Za-z0-9_-]+$/);
  assert.match(
    passwordResetToken,
    /^11111111-1111-4111-8111-111111111111\.[A-Za-z0-9_-]{43}$/,
  );
  assert.equal(
    internals.escape('<script>"x"&</script>'),
    '&lt;script&gt;&quot;x&quot;&amp;&lt;/script&gt;',
  );
  assert.equal(internals.locale('xx'), 'pt-BR');
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
