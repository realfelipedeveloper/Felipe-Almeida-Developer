import { UnauthorizedException } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      METRICS_ENABLED: 'true',
      METRICS_TOKEN: 'm'.repeat(64),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('recusa token ausente ou diferente em produção', () => {
    const controller = new MetricsController(new MetricsService());
    const response = { type: jest.fn(), send: jest.fn() } as never;

    expect(() => controller.getMetrics(undefined, response)).toThrow(UnauthorizedException);
    expect(() => controller.getMetrics('x'.repeat(64), response)).toThrow(UnauthorizedException);
  });

  it('retorna métricas somente com token correto', () => {
    const controller = new MetricsController(new MetricsService());
    const send = jest.fn();
    const response = { type: jest.fn().mockReturnThis(), send } as never;

    controller.getMetrics('m'.repeat(64), response);

    expect(send).toHaveBeenCalledWith(expect.stringContaining('fad_api_uptime_seconds'));
  });
});
