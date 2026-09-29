import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Response } from 'express';
import { MetricsService } from '../metrics/metrics.service';
import { AppLogger } from './app-logger.service';
import type { RequestWithContext } from '../../shared/presentation/request-context';

const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,100}$/;

export function resolveCorrelationId(value: string | undefined): string {
  return value && SAFE_CORRELATION_ID.test(value) ? value : randomUUID();
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
  ) {}

  use(req: RequestWithContext, res: Response, next: NextFunction): void {
    const correlationId = resolveCorrelationId(req.header('x-correlation-id'));
    const startedAt = process.hrtime.bigint();

    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      this.metrics.observeHttpRequest(
        req.method,
        req.route?.path ?? req.path,
        res.statusCode,
        durationMs,
      );
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
