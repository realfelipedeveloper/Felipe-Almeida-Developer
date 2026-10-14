import { Injectable } from '@nestjs/common';
import { AppLogger } from '../../../infra/logging/app-logger.service';
import type { PrivacyAuditLogger } from '../application/privacy.ports';

@Injectable()
export class AppPrivacyAuditLogger implements PrivacyAuditLogger {
  constructor(private readonly logger: AppLogger) {}

  info(message: string): void {
    this.logger.child('seguranca', { componente: 'privacy' }).info(message);
  }

  warn(error: unknown, message: string): void {
    this.logger
      .child('seguranca', { componente: 'privacy-rate-limit' })
      .warn({ erro: error instanceof Error ? error.message : String(error) }, message);
  }
}
