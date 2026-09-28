import { Global, Module } from '@nestjs/common';
import { MetricsModule } from '../metrics/metrics.module';
import { AppLogger } from './app-logger.service';
import { CorrelationIdMiddleware } from './correlation-id.middleware';

@Global()
@Module({
  imports: [MetricsModule],
  providers: [AppLogger, CorrelationIdMiddleware],
  exports: [AppLogger, CorrelationIdMiddleware],
})
export class LoggingModule {}
