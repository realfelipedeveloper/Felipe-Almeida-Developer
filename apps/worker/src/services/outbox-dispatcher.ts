import { PrismaClient, type OutboxEvent } from '@prisma/client';
import type { Channel } from 'amqplib';
import { EVENTS_EXCHANGE, RabbitConnection } from '../infra/rabbitmq.js';
import { logger } from '../infra/logger.js';

const MAX_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 5_000;

export class OutboxDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly rabbit: RabbitConnection,
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;

    try {
      const channel = await this.rabbit.connect();
      const events = await this.prisma.outboxEvent.findMany({
        where: {
          publishedAt: null,
          availableAt: { lte: new Date() },
          attempts: { lt: MAX_ATTEMPTS },
        },
        orderBy: { occurredAt: 'asc' },
        take: 50,
      });

      for (const event of events) {
        await this.publish(channel, event);
      }
    } catch (error) {
      logger.error(
        { categoria: 'filas', erro: error instanceof Error ? error.message : String(error) },
        'Falha no ciclo de publicação da outbox',
      );
    } finally {
      this.running = false;
    }
  }

  private async publish(
    channel: Channel,
    event: OutboxEvent,
  ): Promise<void> {
    if (!event) return;

    const body: { eventId: string; eventName: string; occurredAt: string; correlationId: string; version: number; payload: unknown } = {
      eventId: event.id,
      eventName: event.eventName,
      occurredAt: event.occurredAt.toISOString(),
      correlationId: event.correlationId,
      version: event.version,
      payload: event.payload as Record<string, unknown>,
    };

    try {
      const accepted = channel.publish(EVENTS_EXCHANGE, event.eventName, Buffer.from(JSON.stringify(body)), {
        persistent: true,
        contentType: 'application/json',
        messageId: event.id,
        correlationId: event.correlationId,
        timestamp: event.occurredAt.getTime(),
      });

      if (!accepted) await new Promise<void>((resolve) => channel.once('drain', resolve));

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { publishedAt: new Date(), attempts: { increment: 1 }, lastError: null },
      });

      logger.info(
        { categoria: 'filas', eventId: event.id, eventName: event.eventName, correlationId: event.correlationId },
        'Evento publicado no RabbitMQ',
      );
    } catch (error) {
      const attempts = event.attempts + 1;
      const delayMs = Math.min(1_000 * 2 ** attempts, 15 * 60_000);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          lastError: error instanceof Error ? error.message.slice(0, 4_000) : String(error).slice(0, 4_000),
          availableAt: new Date(Date.now() + delayMs),
        },
      });
      throw error;
    }
  }
}
