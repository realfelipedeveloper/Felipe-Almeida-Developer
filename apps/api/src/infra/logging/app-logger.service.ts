import { Injectable, type LoggerService } from '@nestjs/common';
import pino, { type Logger } from 'pino';

export type LogCategory = 'app' | 'http' | 'auditoria' | 'seguranca' | 'filas';

@Injectable()
export class AppLogger implements LoggerService {
  private readonly logger: Logger;

  constructor() {
    const isDevelopment = (process.env.NODE_ENV ?? 'development') !== 'production';

    this.logger = pino({
      level: process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info'),
      base: {
        service: 'felipe-almeida-developer-api',
        ambiente: process.env.NODE_ENV ?? 'development',
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'authorization',
          'cookie',
          'password',
          '*.password',
          'accessToken',
          'refreshToken',
          '*.accessToken',
          '*.refreshToken',
        ],
        censor: '[REMOVIDO]',
      },
      transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              singleLine: true,
            },
          }
        : undefined,
    });
  }

  child(category: LogCategory, bindings: Record<string, unknown> = {}): Logger {
    return this.logger.child({ categoria: category, ...bindings });
  }

  log(message: unknown, context?: string): void {
    this.logger.info({ contexto: context }, String(message));
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.logger.error({ contexto: context, trace }, String(message));
  }

  warn(message: unknown, context?: string): void {
    this.logger.warn({ contexto: context }, String(message));
  }

  debug(message: unknown, context?: string): void {
    this.logger.debug({ contexto: context }, String(message));
  }

  verbose(message: unknown, context?: string): void {
    this.logger.trace({ contexto: context }, String(message));
  }
}
