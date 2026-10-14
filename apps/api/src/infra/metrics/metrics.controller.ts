import {
  Controller,
  Get,
  Headers,
  NotFoundException,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { MetricsService } from './metrics.service';

@ApiTags('observabilidade')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @ApiExcludeEndpoint()
  getMetrics(
    @Headers('x-metrics-token') token: string | undefined,
    @Res() response: Response,
  ): void {
    if (process.env.METRICS_ENABLED === 'false') {
      throw new NotFoundException();
    }

    const expectedToken = process.env.METRICS_TOKEN;
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction && !secureTokenMatches(expectedToken, token)) {
      throw new UnauthorizedException('Token de métricas inválido.');
    }

    response.type('text/plain; version=0.0.4').send(this.metrics.toPrometheus());
  }
}

function secureTokenMatches(expected: string | undefined, received: string | undefined): boolean {
  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}
