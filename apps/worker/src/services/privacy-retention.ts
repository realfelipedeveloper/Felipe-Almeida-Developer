import type { PrismaClient } from '@prisma/client';
import { logger } from '../infra/logger.js';

const INTERVAL_MS = 60 * 60 * 1_000;

export class PrivacyRetentionService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaClient) {}

  start(): void {
    void this.runOnce();
    this.timer = setInterval(() => void this.runOnce(), INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runOnce(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`
          UPDATE privacy_requests
          SET email = 'deleted+' || id::text || '@privacy.invalid',
              status = 'EXPIRED'::"PrivacyRequestStatus",
              verification_token_hash = NULL,
              verification_expires_at = NULL
          WHERE status IN ('PENDING', 'VERIFIED')
            AND verification_expires_at < NOW()
        `);
        await tx.$executeRawUnsafe(`
          UPDATE outbox_events
          SET payload = jsonb_build_object('redacted', true, 'reason', 'privacy-retention')
          WHERE event_name = 'privacy.verification.requested'
            AND occurred_at < NOW() - INTERVAL '1 day'
        `);
        await tx.$executeRawUnsafe(`
          DELETE FROM consent_records
          WHERE subject_kind = 'ANONYMOUS_BROWSER'
            AND created_at < NOW() - INTERVAL '13 months'
        `);
        await tx.$executeRawUnsafe(`
          DELETE FROM outbox_events
          WHERE event_name = 'privacy.verification.requested'
            AND published_at IS NOT NULL
            AND occurred_at < NOW() - INTERVAL '30 days'
        `);
        await tx.$executeRawUnsafe(`
          DELETE FROM privacy_erasure_tombstones
          WHERE erased_at < NOW() - INTERVAL '1 day'
        `);
      });
    } catch (error) {
      logger.error(
        {
          categoria: 'privacidade',
          erro: error instanceof Error ? error.message : String(error),
        },
        'Falha na rotina de retenção de privacidade',
      );
    } finally {
      this.running = false;
    }
  }
}
