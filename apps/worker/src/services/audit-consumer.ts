import { Prisma, PrismaClient } from '@prisma/client';
import type { ConsumeMessage } from 'amqplib';
import { parseEventEnvelope } from '../domain/event-envelope.js';
import { RabbitConnection } from '../infra/rabbitmq.js';
import { logger } from '../infra/logger.js';
import { workerMetrics, type WorkerMetrics } from '../infra/worker-metrics.js';

const CONSUMER_NAME = 'worker.audit.v1';
const MAX_RETRIES = 5;

export class AuditConsumer {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly rabbit: RabbitConnection,
    private readonly metrics: WorkerMetrics = workerMetrics,
  ) {}

  async start(): Promise<void> {
    await this.rabbit.consumeAudit((message) => this.handle(message));
  }

  private async handle(message: ConsumeMessage): Promise<void> {
    try {
      const event = parseEventEnvelope(message.content);
      const processed = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`
          SELECT 1 AS acquired
          FROM pg_advisory_xact_lock(hashtextextended(${event.eventId}, 2))
        `);
        const existing = await tx.processedEvent.findUnique({
          where: { eventId_consumer: { eventId: event.eventId, consumer: CONSUMER_NAME } },
        });

        if (existing) return false;

        logger.info(
          {
            categoria: 'filas',
            eventId: event.eventId,
            eventName: event.eventName,
            correlationId: event.correlationId,
          },
          'Evento recebido pelo consumidor de auditoria',
        );

        await tx.processedEvent.create({
          data: { eventId: event.eventId, consumer: CONSUMER_NAME },
        });
        return true;
      });
      this.metrics.increment(processed ? 'audit_processed' : 'audit_duplicate');
      this.rabbit.ack(message);
    } catch (error) {
      this.metrics.increment('audit_failed');
      const currentRetry = Number(message.properties.headers?.['x-fad-retry-count'] ?? 0);
      const reason =
        error instanceof Error && error.message === 'INVALID_EVENT_ENVELOPE'
          ? error.message
          : 'AUDIT_EVENT_PROCESSING_FAILED';

      logger.error(
        {
          categoria: 'filas',
          retry: currentRetry,
          erro: reason,
          messageId: message.properties.messageId,
        },
        'Falha ao consumir evento',
      );

      if (currentRetry >= MAX_RETRIES) {
        await this.rabbit.deadLetter(message, reason);
        return;
      }

      await this.rabbit.retry(message, currentRetry);
    }
  }
}
