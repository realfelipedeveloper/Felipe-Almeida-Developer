import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminContentService } from './application/admin-content.service';
import { AdminContentController } from './presentation/admin-content.controller';

@Module({
  imports: [AuthModule],
  controllers: [AdminContentController],
  providers: [AdminContentService],
})
export class AdminModule {}
