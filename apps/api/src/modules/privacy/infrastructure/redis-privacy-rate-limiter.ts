import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../infra/redis/redis.service';
import type { PrivacyRateLimiter } from '../application/privacy.ports';

@Injectable()
export class RedisPrivacyRateLimiter implements PrivacyRateLimiter {
  constructor(private readonly redis: RedisService) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    return Number(
      await this.redis.connection.eval(
        `local current = redis.call('INCR', KEYS[1])
         if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
         return current`,
        1,
        key,
        ttlSeconds,
      ),
    );
  }
}
