import { Module } from '@nestjs/common';
import { EngagementService } from './application/engagement.service';
import { EngagementController } from './presentation/engagement.controller';

@Module({
  controllers: [EngagementController],
  providers: [EngagementService],
})
export class EngagementModule {}
