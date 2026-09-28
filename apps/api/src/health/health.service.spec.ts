import { HealthService } from './health.service';

describe('HealthService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retorna status ok da API', () => {
    const service = new HealthService(prisma as never);

    expect(service.getStatus()).toEqual(
      expect.objectContaining({
        status: 'ok',
        service: 'felipe-almeida-developer-api',
        version: '0.3.0',
      }),
    );
  });

  it('retorna status ok quando o PostgreSQL responde', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const service = new HealthService(prisma as never);

    await expect(service.getDatabaseStatus()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        database: 'postgresql',
      }),
    );
  });

  it('retorna status down quando o PostgreSQL falha', async () => {
    prisma.$queryRaw.mockRejectedValueOnce(new Error('database unavailable'));
    const service = new HealthService(prisma as never);

    await expect(service.getDatabaseStatus()).resolves.toEqual(
      expect.objectContaining({
        status: 'down',
        database: 'postgresql',
      }),
    );
  });
});
