import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { AppLogger } from '../../../infra/logging/app-logger.service';
import { RedisService } from '../../../infra/redis/redis.service';

const WINDOW_SECONDS = 60;
const DEFAULT_LIMIT = 240;

@Injectable()
export class MediaRateLimitGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const identity = request.ip || request.socket.remoteAddress || 'unknown';
    const digest = createHash('sha256').update(identity).digest('hex');
    const key = `rate:public-media:${digest}`;
    const limit = this.configuredLimit();

    try {
      const count = Number(
        await this.redis.connection.eval(
          `local current = redis.call('INCR', KEYS[1])
           if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
           return current`,
          1,
          key,
          WINDOW_SECONDS,
        ),
      );
      if (count > limit) {
        throw new HttpException('Muitas solicitações de mídia.', HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger
        .child('seguranca', { componente: 'media-rate-limit' })
        .warn(
          { erro: error instanceof Error ? error.message : String(error) },
          'Rate limit de mídia indisponível; requisição liberada em modo degradado',
        );
    }
    return true;
  }

  private configuredLimit(): number {
    const value = Number(process.env.MEDIA_RATE_LIMIT_PER_MINUTE ?? DEFAULT_LIMIT);
    return Number.isInteger(value) && value > 0 ? value : DEFAULT_LIMIT;
  }
}
