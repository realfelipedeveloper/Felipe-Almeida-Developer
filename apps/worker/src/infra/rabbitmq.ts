import * as amqp from 'amqplib';
import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { logger } from './logger.js';
import { workerMetrics, type WorkerMetrics } from './worker-metrics.js';

export const EVENTS_EXCHANGE = 'fad.events';
const RETRY_EXCHANGE = 'fad.events.retry';
const DLX_EXCHANGE = 'fad.events.dlx';

const AUDIT_QUEUE = 'fad.events.audit';
const NOTIFICATION_QUEUE = 'fad.events.notifications';

const RETRY_QUEUE = 'fad.events.audit.retry';
const DLQ = 'fad.events.audit.dlq';
const DEFAULT_PUBLISH_CONFIRM_TIMEOUT_MS = 10_000;

export class RabbitConnection {
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: ConfirmChannel | null = null;
  private closing = false;
  private failed = false;

  constructor(
    private readonly metrics: WorkerMetrics = workerMetrics,
    private readonly publishConfirmTimeoutMs = DEFAULT_PUBLISH_CONFIRM_TIMEOUT_MS,
    private readonly fatalHandler: (code: string) => void = () => undefined,
  ) {}

  isConnected(): boolean {
    return Boolean(!this.failed && this.connection && this.channel);
  }

  async connect(): Promise<ConfirmChannel> {
    if (this.failed) throw new Error('RABBITMQ_RESTART_REQUIRED');
    if (this.channel) return this.channel;

    if (!this.connection) {
      const connection = await amqp.connect(
        process.env.RABBITMQ_URL ?? 'amqp://fad:fad@localhost:5672',
      );
      this.connection = connection;
      connection.on('close', () => {
        logger.warn({ categoria: 'filas' }, 'Conexão RabbitMQ encerrada');
        if (this.connection === connection) {
          this.connection = null;
          this.channel = null;
        }
        this.markFailed('RABBITMQ_CONNECTION_CLOSED');
      });
      connection.on('error', (error) => {
        logger.error({ categoria: 'filas', codigo: error.name }, 'Erro na conexão RabbitMQ');
        this.markFailed('RABBITMQ_CONNECTION_ERROR');
      });
    }

    const channel = await this.connection.createConfirmChannel();
    this.channel = channel;
    this.watchChannel(channel);
    try {
      await this.setupTopology(channel);
      return channel;
    } catch (error) {
      this.invalidateChannel(channel, 'RABBITMQ_TOPOLOGY_FAILED');
      throw error;
    }
  }

  async close(): Promise<void> {
    this.closing = true;
    const channel = this.channel;
    const connection = this.connection;
    this.channel = null;
    this.connection = null;
    await Promise.all([
      this.closeWithDeadline(() => channel?.close()),
      this.closeWithDeadline(() => connection?.close()),
    ]);
  }

  async consumeAudit(handler: (message: ConsumeMessage) => Promise<void>): Promise<void> {
    const channel = await this.connect();
    await channel.prefetch(10);
    await channel.consume(AUDIT_QUEUE, (message) => {
      if (message) this.consumeSafely(channel, message, handler);
    });
  }

  async consumeNotifications(handler: (message: ConsumeMessage) => Promise<void>): Promise<void> {
    const channel = await this.connect();
    await channel.prefetch(5);
    await channel.consume(NOTIFICATION_QUEUE, (message) => {
      if (message) this.consumeSafely(channel, message, handler);
    });
  }

  async retry(message: ConsumeMessage, retryCount: number): Promise<void> {
    const channel = await this.connect();
    const delay = Math.min(1_000 * 2 ** retryCount, 60_000);

    const accepted = channel.publish(RETRY_EXCHANGE, message.fields.routingKey, message.content, {
      ...message.properties,
      persistent: true,
      expiration: String(delay),
      headers: {
        ...message.properties.headers,
        'x-fad-retry-count': retryCount + 1,
      },
    });
    await this.confirmPublish(channel, accepted);
    this.metrics.increment('retry_published');
    channel.ack(message);
  }

  async deadLetter(message: ConsumeMessage, reason: string): Promise<void> {
    const channel = await this.connect();
    const accepted = channel.publish(DLX_EXCHANGE, message.fields.routingKey, message.content, {
      ...message.properties,
      persistent: true,
      headers: {
        ...message.properties.headers,
        'x-fad-dead-letter-reason': reason,
      },
    });
    await this.confirmPublish(channel, accepted);
    this.metrics.increment('dead_letter_published');
    channel.ack(message);
  }

  ack(message: ConsumeMessage): void {
    this.channel?.ack(message);
  }

  async confirmPublish(channel: ConfirmChannel, accepted: boolean): Promise<void> {
    try {
      if (!accepted) {
        await this.withChannelDeadline(
          channel,
          new Promise<void>((resolve) => channel.once('drain', resolve)),
        );
      }
      await this.withChannelDeadline(channel, channel.waitForConfirms());
    } catch {
      this.invalidateChannel(channel, 'RABBITMQ_PUBLISH_CONFIRMATION_FAILED');
      throw new Error('RABBITMQ_PUBLISH_CONFIRMATION_FAILED');
    }
  }

  private watchChannel(channel: ConfirmChannel): void {
    channel.on('close', () => {
      logger.warn({ categoria: 'filas' }, 'Canal RabbitMQ encerrado');
      if (this.channel === channel) this.channel = null;
      this.markFailed('RABBITMQ_CHANNEL_CLOSED');
    });
    channel.on('error', (error) => {
      logger.error({ categoria: 'filas', codigo: error.name }, 'Erro no canal RabbitMQ');
      if (this.channel === channel) this.channel = null;
      this.markFailed('RABBITMQ_CHANNEL_ERROR');
    });
  }

  private async withChannelDeadline(
    channel: ConfirmChannel,
    operation: Promise<void>,
  ): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    let onClose: (() => void) | undefined;
    let onError: (() => void) | undefined;
    const unavailable = new Promise<never>((_resolve, reject) => {
      const fail = () => reject(new Error('RABBITMQ_CHANNEL_UNAVAILABLE'));
      onClose = fail;
      onError = fail;
      channel.once('close', onClose);
      channel.once('error', onError);
      timer = setTimeout(
        () => reject(new Error('RABBITMQ_PUBLISH_CONFIRMATION_TIMEOUT')),
        this.publishConfirmTimeoutMs,
      );
    });

    try {
      await Promise.race([operation, unavailable]);
    } finally {
      if (timer) clearTimeout(timer);
      if (onClose) channel.off('close', onClose);
      if (onError) channel.off('error', onError);
    }
  }

  private invalidateChannel(channel: ConfirmChannel, code: string): void {
    const connection = this.connection;
    if (this.channel === channel) this.channel = null;
    this.connection = null;
    this.markFailed(code);
    void this.closeWithDeadline(() => channel.close());
    void this.closeWithDeadline(() => connection?.close());
  }

  private async closeWithDeadline(close: () => Promise<unknown> | undefined): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.resolve(close()).catch(() => undefined),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, this.publishConfirmTimeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private markFailed(code: string): void {
    if (this.closing || this.failed) return;
    this.failed = true;
    this.channel = null;
    this.connection = null;
    this.fatalHandler(code);
  }

  private consumeSafely(
    channel: ConfirmChannel,
    message: ConsumeMessage,
    handler: (message: ConsumeMessage) => Promise<void>,
  ): void {
    void handler(message).catch(async () => {
      logger.error(
        { categoria: 'filas', codigo: 'CONSUMER_HANDLER_FAILED' },
        'Consumidor falhou antes de confirmar a mensagem; canal será reiniciado',
      );
      this.invalidateChannel(channel, 'RABBITMQ_CONSUMER_HANDLER_FAILED');
    });
  }

  private async setupTopology(channel: ConfirmChannel): Promise<void> {
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(RETRY_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(DLX_EXCHANGE, 'topic', { durable: true });

    await channel.assertQueue(AUDIT_QUEUE, { durable: true });
    await channel.bindQueue(AUDIT_QUEUE, EVENTS_EXCHANGE, '#');

    await channel.assertQueue(NOTIFICATION_QUEUE, { durable: true });
    await channel.bindQueue(NOTIFICATION_QUEUE, EVENTS_EXCHANGE, 'contact.submitted');
    await channel.bindQueue(NOTIFICATION_QUEUE, EVENTS_EXCHANGE, 'contact.created');
    await channel.bindQueue(NOTIFICATION_QUEUE, EVENTS_EXCHANGE, 'newsletter.subscribed');
    await channel.bindQueue(
      NOTIFICATION_QUEUE,
      EVENTS_EXCHANGE,
      'newsletter.confirmation.requested',
    );
    await channel.bindQueue(NOTIFICATION_QUEUE, EVENTS_EXCHANGE, 'newsletter.confirmed');
    await channel.bindQueue(NOTIFICATION_QUEUE, EVENTS_EXCHANGE, 'admin.password-reset.requested');
    await channel.bindQueue(NOTIFICATION_QUEUE, EVENTS_EXCHANGE, 'privacy.verification.requested');

    /**
     * Mantemos os nomes das filas já existentes para não quebrar ambientes
     * que tenham sido criados nas partes anteriores. A fila de retry é
     * compartilhada entre os consumidores e devolve a mensagem ao exchange
     * principal após o TTL.
     */
    await channel.assertQueue(RETRY_QUEUE, {
      durable: true,
      deadLetterExchange: EVENTS_EXCHANGE,
    });
    await channel.bindQueue(RETRY_QUEUE, RETRY_EXCHANGE, '#');

    await channel.assertQueue(DLQ, { durable: true });
    await channel.bindQueue(DLQ, DLX_EXCHANGE, '#');
  }
}
