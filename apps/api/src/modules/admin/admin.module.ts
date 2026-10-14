import { Module } from '@nestjs/common';
import { DomPurifyRichTextSanitizer } from '../../infra/security/dom-purify-rich-text-sanitizer';
import { RICH_TEXT_SANITIZER } from '../../shared/application/rich-text-sanitizer';
import { AuthModule } from '../auth/auth.module';
import { AdminContentService } from './application/admin-content.service';
import { AdminEngagementService } from './application/admin-engagement.service';
import { AdminContentController } from './presentation/admin-content.controller';
import { AdminEngagementController } from './presentation/admin-engagement.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminContentController, AdminEngagementController],
  providers: [
    AdminContentService,
    AdminEngagementService,
    {
      provide: RICH_TEXT_SANITIZER,
      useClass: DomPurifyRichTextSanitizer,
    },
  ],
})
export class AdminModule {}
