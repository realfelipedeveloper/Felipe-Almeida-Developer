import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminContentService } from './application/admin-content.service';
import { AdminEngagementService } from './application/admin-engagement.service';
import { AdminContentController } from './presentation/admin-content.controller';
import { AdminEngagementController } from './presentation/admin-engagement.controller';

@Module({
  imports: [AuthModule],
  controllers: [
    AdminContentController,
    AdminEngagementController,
  ],
  providers: [
    AdminContentService,
    AdminEngagementService,
  ],
})
export class AdminModule {}
