import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import * as amqp from 'amqplib';
import type { Channel } from 'amqplib';
import { AppLogger } from '../logging/app-logger.service';

const EVENTS_EXCHANGE = 'fad.events';

@Injectable()
export class RabbitMqService implements OnModuleInit, OnApplicationShutdown {
  private connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  private channel: Channel | null = null;

  constructor(private readonly logger: AppLogger) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureConnected();
      this.logger.child('filas', { dependencia: 'rabbitmq' }).info('RabbitMQ conectado');
    } catch (error) {
      this.logger.child('filas', { dependencia: 'rabbitmq' }).warn(
        { erro: error instanceof Error ? error.message : String(error) },
        'RabbitMQ indisponível durante a inicialização; a conexão será refeita sob demanda',
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
  }

  async ping(): Promise<void> {
    await this.ensureConnected();
  }

  async publish(eventName: string, body: unknown, options: { eventId: string; correlationId: string }): Promise<void> {
    const channel = await this.ensureConnected();
    const accepted = channel.publish(EVENTS_EXCHANGE, eventName, Buffer.from(JSON.stringify(body)), {
      persistent: true,
      contentType: 'application/json',
      messageId: options.eventId,
      correlationId: options.correlationId,
      timestamp: Date.now(),
    });

    if (!accepted) {
      await new Promise<void>((resolve) => channel.once('drain', resolve));
    }
  }

  private async ensureConnected(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    this.connection = await amqp.connect(process.env.RABBITMQ_URL ?? 'amqp://fad:fad@localhost:5672');
    this.connection.on('close', () => {
      this.channel = null;
      this.connection = null;
    });
    this.connection.on('error', () => {
      this.channel = null;
    });

    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    return this.channel;
  }
}
