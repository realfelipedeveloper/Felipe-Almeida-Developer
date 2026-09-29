import * as amqp from 'amqplib';
import type {
  Channel,
  ConsumeMessage,
} from 'amqplib';
import { logger } from './logger.js';

export const EVENTS_EXCHANGE = 'fad.events';
const RETRY_EXCHANGE = 'fad.events.retry';
const DLX_EXCHANGE = 'fad.events.dlx';

const AUDIT_QUEUE = 'fad.events.audit';
const NOTIFICATION_QUEUE =
  'fad.events.notifications';

const RETRY_QUEUE = 'fad.events.audit.retry';
const DLQ = 'fad.events.audit.dlq';

export class RabbitConnection {
  private connection: Awaited<
    ReturnType<typeof amqp.connect>
  > | null = null;
  private channel: Channel | null = null;

  async connect(): Promise<Channel> {
    if (this.channel) return this.channel;

    this.connection = await amqp.connect(
      process.env.RABBITMQ_URL ??
        'amqp://fad:fad@localhost:5672',
    );

    this.connection.on('close', () => {
      logger.warn(
        { categoria: 'filas' },
        'Conexão RabbitMQ encerrada',
      );
      this.connection = null;
      this.channel = null;
    });

    this.connection.on(
      'error',
      (error) => {
        logger.error(
          {
            categoria: 'filas',
            erro: error.message,
          },
          'Erro na conexão RabbitMQ',
        );
      },
    );

    this.channel =
      await this.connection.createChannel();

    await this.setupTopology(
      this.channel,
    );

    return this.channel;
  }

  async close(): Promise<void> {
    await this.channel
      ?.close()
      .catch(() => undefined);

    await this.connection
      ?.close()
      .catch(() => undefined);

    this.channel = null;
    this.connection = null;
  }

  async consumeAudit(
    handler: (
      message: ConsumeMessage,
    ) => Promise<void>,
  ): Promise<void> {
    const channel = await this.connect();

    await channel.prefetch(10);
    await channel.consume(
      AUDIT_QUEUE,
      async (message) => {
        if (message) {
          await handler(message);
        }
      },
    );
  }

  async consumeNotifications(
    handler: (
      message: ConsumeMessage,
    ) => Promise<void>,
  ): Promise<void> {
    const channel = await this.connect();

    await channel.prefetch(5);
    await channel.consume(
      NOTIFICATION_QUEUE,
      async (message) => {
        if (message) {
          await handler(message);
        }
      },
    );
  }

  async retry(
    message: ConsumeMessage,
    retryCount: number,
  ): Promise<void> {
    const channel = await this.connect();

    const delay = Math.min(
      1_000 * 2 ** retryCount,
      60_000,
    );

    channel.publish(
      RETRY_EXCHANGE,
      message.fields.routingKey,
      message.content,
      {
        ...message.properties,
        persistent: true,
        expiration: String(delay),
        headers: {
          ...message.properties.headers,
          'x-fad-retry-count':
            retryCount + 1,
        },
      },
    );

    channel.ack(message);
  }

  async deadLetter(
    message: ConsumeMessage,
    reason: string,
  ): Promise<void> {
    const channel = await this.connect();

    channel.publish(
      DLX_EXCHANGE,
      message.fields.routingKey,
      message.content,
      {
        ...message.properties,
        persistent: true,
        headers: {
          ...message.properties.headers,
          'x-fad-dead-letter-reason':
            reason,
        },
      },
    );

    channel.ack(message);
  }

  ack(message: ConsumeMessage): void {
    this.channel?.ack(message);
  }

  private async setupTopology(
    channel: Channel,
  ): Promise<void> {
    await channel.assertExchange(
      EVENTS_EXCHANGE,
      'topic',
      { durable: true },
    );

    await channel.assertExchange(
      RETRY_EXCHANGE,
      'topic',
      { durable: true },
    );

    await channel.assertExchange(
      DLX_EXCHANGE,
      'topic',
      { durable: true },
    );

    await channel.assertQueue(
      AUDIT_QUEUE,
      { durable: true },
    );

    await channel.bindQueue(
      AUDIT_QUEUE,
      EVENTS_EXCHANGE,
      '#',
    );

    await channel.assertQueue(
      NOTIFICATION_QUEUE,
      { durable: true },
    );

    await channel.bindQueue(
      NOTIFICATION_QUEUE,
      EVENTS_EXCHANGE,
      'contact.created',
    );

    await channel.bindQueue(
      NOTIFICATION_QUEUE,
      EVENTS_EXCHANGE,
      'newsletter.confirmation.requested',
    );

    await channel.bindQueue(
      NOTIFICATION_QUEUE,
      EVENTS_EXCHANGE,
      'newsletter.confirmed',
    );

    await channel.bindQueue(
      NOTIFICATION_QUEUE,
      EVENTS_EXCHANGE,
      'admin.password-reset.requested',
    );

    /**
     * Mantemos os nomes das filas já existentes para não quebrar ambientes
     * que tenham sido criados nas partes anteriores. A fila de retry é
     * compartilhada entre os consumidores e devolve a mensagem ao exchange
     * principal após o TTL.
     */
    await channel.assertQueue(
      RETRY_QUEUE,
      {
        durable: true,
        deadLetterExchange:
          EVENTS_EXCHANGE,
      },
    );

    await channel.bindQueue(
      RETRY_QUEUE,
      RETRY_EXCHANGE,
      '#',
    );

    await channel.assertQueue(DLQ, {
      durable: true,
    });

    await channel.bindQueue(
      DLQ,
      DLX_EXCHANGE,
      '#',
    );
  }
}
