import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infra/prisma/prisma.service';
import { RedisService } from '../infra/redis/redis.service';
import { RabbitMqService } from '../infra/rabbitmq/rabbitmq.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly rabbitMq: RabbitMqService,
  ) {}

  getStatus() {
    return {
      status: 'ok',
      service: 'felipe-almeida-developer-api',
      version: '0.8.0',
      timestamp: new Date().toISOString(),
    };
  }

  async getDatabaseStatus() {
    const startedAt = Date.now();

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.result('postgresql', 'ok', startedAt);
    } catch {
      return this.result('postgresql', 'down', startedAt);
    }
  }

  async getDependenciesStatus() {
    const [postgresql, redis, rabbitmq] = await Promise.all([
      this.getDatabaseStatus(),
      this.check('redis', () => this.redis.ping()),
      this.check('rabbitmq', () => this.rabbitMq.ping()),
    ]);

    const dependencies = { postgresql, redis, rabbitmq };
    return {
      status: Object.values(dependencies).every(
        (item) => item.status === 'ok',
      )
        ? 'ok'
        : 'degraded',
      dependencies,
      timestamp: new Date().toISOString(),
    };
  }

  private async check(name: string, action: () => Promise<unknown>) {
    const startedAt = Date.now();
    try {
      await action();
      return this.result(name, 'ok', startedAt);
    } catch {
      return this.result(name, 'down', startedAt);
    }
  }

  private result(
    name: string,
    status: 'ok' | 'down',
    startedAt: number,
  ) {
    return {
      status,
      dependency: name,
      latencyMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    };
  }
}
