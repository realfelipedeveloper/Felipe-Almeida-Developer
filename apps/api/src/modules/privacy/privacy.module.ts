import { Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module';
import {
  PRIVACY_AUDIT_LOGGER,
  PRIVACY_RATE_LIMITER,
  PRIVACY_REPOSITORY,
} from './application/privacy.ports';
import { PrivacyService } from './application/privacy.service';
import { AppPrivacyAuditLogger } from './infrastructure/privacy-audit-logger';
import { PrismaPrivacyRepository } from './infrastructure/prisma-privacy.repository';
import { RedisPrivacyRateLimiter } from './infrastructure/redis-privacy-rate-limiter';
import { PrivacyController } from './presentation/privacy.controller';

@Module({
  imports: [EngagementModule],
  controllers: [PrivacyController],
  providers: [
    PrivacyService,
    { provide: PRIVACY_REPOSITORY, useClass: PrismaPrivacyRepository },
    { provide: PRIVACY_RATE_LIMITER, useClass: RedisPrivacyRateLimiter },
    { provide: PRIVACY_AUDIT_LOGGER, useClass: AppPrivacyAuditLogger },
  ],
})
export class PrivacyModule {}
