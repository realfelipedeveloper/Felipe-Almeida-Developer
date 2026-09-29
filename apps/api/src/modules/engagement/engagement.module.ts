import { Module } from '@nestjs/common';
import { EngagementService } from './application/engagement.service';
import { TurnstileService } from './application/turnstile.service';
import { EngagementController } from './presentation/engagement.controller';

@Module({
  controllers: [EngagementController],
  providers: [EngagementService, TurnstileService],
})
export class EngagementModule {}
