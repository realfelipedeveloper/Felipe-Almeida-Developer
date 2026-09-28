import { HealthService } from './health.service';

describe('HealthService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };
  const redis = {
    ping: jest.fn(),
  };
  const rabbitMq = {
    ping: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService() {
    return new HealthService(prisma as never, redis as never, rabbitMq as never);
  }

  it('retorna status ok da API', () => {
    expect(createService().getStatus()).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'felipe-almeida-developer-api',
        version: '0.4.0',
      }),
    );
  });

  it('retorna status ok quando o PostgreSQL responde', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    await expect(createService().getDatabaseStatus()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        dependency: 'postgresql',
      }),
    );
  });

  it('retorna status down quando o PostgreSQL falha', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(createService().getDatabaseStatus()).resolves.toEqual(
      expect.objectContaining({
        status: 'down',
        dependency: 'postgresql',
      }),
    );
  });

  it('retorna degradado quando uma dependência crítica falha', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    redis.ping.mockResolvedValueOnce('PONG');
    rabbitMq.ping.mockRejectedValueOnce(new Error('rabbit unavailable'));

    await expect(createService().getDependenciesStatus()).resolves.toEqual(
      expect.objectContaining({ status: 'degraded' }),
    );
  });
});
