import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MEDIA_REPOSITORY } from './application/media.repository';
import {
  MEDIA_MALWARE_SCANNER,
  type MediaMalwareScanner,
  NoopMediaMalwareScanner,
} from './application/media-malware-scanner';
import { MEDIA_STORAGE, type MediaStorage } from './application/media-storage';
import { MediaService } from './application/media.service';
import { LocalMediaStorage } from './infrastructure/local-media.storage';
import { ClamAvMediaMalwareScanner } from './infrastructure/clamav-media-malware-scanner';
import { PrismaMediaRepository } from './infrastructure/prisma-media.repository';
import { S3MediaStorage } from './infrastructure/s3-media.storage';
import { AdminMediaController } from './presentation/admin-media.controller';
import { PublicMediaController } from './presentation/public-media.controller';
import { MediaRateLimitGuard } from './presentation/media-rate-limit.guard';

@Module({
  imports: [AuthModule],
  controllers: [AdminMediaController, PublicMediaController],
  providers: [
    MediaService,
    MediaRateLimitGuard,
    { provide: MEDIA_REPOSITORY, useClass: PrismaMediaRepository },
    {
      provide: MEDIA_MALWARE_SCANNER,
      useFactory: (): MediaMalwareScanner => {
        if (process.env.CLAMAV_HOST?.trim()) return new ClamAvMediaMalwareScanner();
        if ((process.env.NODE_ENV ?? 'development') === 'production') {
          throw new Error('CLAMAV_HOST é obrigatório em produção para validar uploads.');
        }
        return new NoopMediaMalwareScanner();
      },
    },
    {
      provide: MEDIA_STORAGE,
      useFactory: (): MediaStorage => {
        const configured = process.env.MEDIA_STORAGE_PROVIDER?.trim().toLowerCase();
        if (configured === 's3' || configured === 'object_storage') return new S3MediaStorage();
        if ((process.env.NODE_ENV ?? 'development') === 'production') {
          throw new Error('MEDIA_STORAGE_PROVIDER=s3 é obrigatório em produção.');
        }
        return new LocalMediaStorage();
      },
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
