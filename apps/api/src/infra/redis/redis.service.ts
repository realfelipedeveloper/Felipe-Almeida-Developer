import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { AppLogger } from '../logging/app-logger.service';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly client: Redis;

  constructor(private readonly logger: AppLogger) {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });

    this.client.on('error', (error) => {
      this.logger.child('app', { dependencia: 'redis' }).warn({ erro: error.message }, 'Falha de comunicação com Redis');
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      await this.client.ping();
      this.logger.child('app', { dependencia: 'redis' }).info('Redis conectado');
    } catch (error) {
      this.logger.child('app', { dependencia: 'redis' }).warn(
        { erro: error instanceof Error ? error.message : String(error) },
        'Redis indisponível durante a inicialização; a API continuará sem cache até a recuperação',
      );
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status !== 'end') {
      await this.client.quit().catch(() => undefined);
    }
  }

  get connection(): Redis {
    return this.client;
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
