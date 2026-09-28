import { PrismaClient } from '@prisma/client';
import type { ConsumeMessage } from 'amqplib';
import { RabbitConnection } from '../infra/rabbitmq.js';
import { logger } from '../infra/logger.js';

const CONSUMER_NAME = 'worker.audit.v1';
const MAX_RETRIES = 5;

export class AuditConsumer {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly rabbit: RabbitConnection,
  ) {}

  async start(): Promise<void> {
    await this.rabbit.consumeAudit((message) => this.handle(message));
  }

  private async handle(message: ConsumeMessage): Promise<void> {
    try {
      const event = JSON.parse(message.content.toString('utf8')) as {
        eventId: string;
        eventName: string;
        occurredAt: string;
        correlationId: string;
        version: number;
        payload: unknown;
      };
      const existing = await this.prisma.processedEvent.findUnique({
        where: { eventId_consumer: { eventId: event.eventId, consumer: CONSUMER_NAME } },
      });

      if (existing) {
        this.rabbit.ack(message);
        return;
      }

      logger.info(
        {
          categoria: 'filas',
          eventId: event.eventId,
          eventName: event.eventName,
          correlationId: event.correlationId,
        },
        'Evento recebido pelo consumidor de auditoria',
      );

      await this.prisma.processedEvent.create({
        data: { eventId: event.eventId, consumer: CONSUMER_NAME },
      });
      this.rabbit.ack(message);
    } catch (error) {
      const currentRetry = Number(message.properties.headers?.['x-fad-retry-count'] ?? 0);
      const reason = error instanceof Error ? error.message : String(error);

      logger.error(
        { categoria: 'filas', retry: currentRetry, erro: reason, messageId: message.properties.messageId },
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
