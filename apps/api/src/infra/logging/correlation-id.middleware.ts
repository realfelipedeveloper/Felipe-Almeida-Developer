import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';
import { AppLogger } from './app-logger.service';
import type { RequestWithContext } from '../../shared/presentation/request-context';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
  ) {}

  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const incoming = req.header('x-correlation-id');
    const correlationId = incoming && incoming.length <= 100 ? incoming : randomUUID();
    const startedAt = process.hrtime.bigint();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.metrics.observeHttpRequest(req.method, req.route?.path ?? req.path, res.statusCode, durationMs);
      this.logger.child('http', { correlationId }).info(
        {
          metodo: req.method,
          caminho: req.originalUrl,
          statusCode: res.statusCode,
          duracaoMs: Number(durationMs.toFixed(2)),
        },
        'Requisição concluída',
      );
    });

    next();
  }
}
