import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';
import { AppLogger } from '../logging/app-logger.service';

@Injectable()
export class CacheService {
  constructor(
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.connection.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.logger.child('app', { dependencia: 'redis', chave: key }).debug(
        { erro: error instanceof Error ? error.message : String(error) },
        'Leitura de cache ignorada',
      );
    }

    const value = await loader();

    try {
      await this.redis.connection.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (error) {
      this.logger.child('app', { dependencia: 'redis', chave: key }).debug(
        { erro: error instanceof Error ? error.message : String(error) },
        'Escrita de cache ignorada',
      );
    }

    return value;
  }

  async invalidateByPrefix(prefix: string): Promise<void> {
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.redis.connection.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.redis.connection.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.child('app', { dependencia: 'redis', prefixo: prefix }).warn(
        { erro: error instanceof Error ? error.message : String(error) },
        'Não foi possível invalidar o cache',
      );
    }
  }
}
