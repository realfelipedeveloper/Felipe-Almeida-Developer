import type { ExecutionContext } from '@nestjs/common';
import type { AppLogger } from '../../../infra/logging/app-logger.service';
import type { RedisService } from '../../../infra/redis/redis.service';
import { MediaRateLimitGuard } from './media-rate-limit.guard';

function context(ip = '203.0.113.10') {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip, socket: {}, headers: {} }),
    }),
  } as unknown as ExecutionContext;
}

function setup(count: number) {
  const connection = {
    eval: jest.fn().mockResolvedValue(count),
  };
  const logger = {
    child: jest.fn().mockReturnValue({ warn: jest.fn() }),
  } as unknown as AppLogger;
  const redis = { connection } as unknown as RedisService;
  return { connection, guard: new MediaRateLimitGuard(redis, logger) };
}

describe('MediaRateLimitGuard', () => {
  it('cria uma janela expirada sem persistir o IP em texto claro', async () => {
    const { connection, guard } = setup(1);

    await expect(guard.canActivate(context())).resolves.toBe(true);

    expect(connection.eval).toHaveBeenCalledWith(expect.any(String), 1, expect.any(String), 60);
    expect(connection.eval.mock.calls[0][2]).not.toContain('203.0.113.10');
  });

  it('responde 429 quando o limite é excedido', async () => {
    const previous = process.env.MEDIA_RATE_LIMIT_PER_MINUTE;
    process.env.MEDIA_RATE_LIMIT_PER_MINUTE = '1';
    const { guard } = setup(2);
    try {
      await expect(guard.canActivate(context())).rejects.toMatchObject({ status: 429 });
    } finally {
      if (previous === undefined) delete process.env.MEDIA_RATE_LIMIT_PER_MINUTE;
      else process.env.MEDIA_RATE_LIMIT_PER_MINUTE = previous;
    }
  });
});
