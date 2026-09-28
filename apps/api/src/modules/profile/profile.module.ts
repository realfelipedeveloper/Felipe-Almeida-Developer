import { Module } from '@nestjs/common';
import { PROFILE_PUBLIC_READ_REPOSITORY } from './application/profile-public.types';
import { ProfilePublicService } from './application/profile-public.service';
import { PrismaProfilePublicReadRepository } from './infrastructure/prisma-profile-public-read.repository';
import { ProfilePublicController } from './presentation/profile-public.controller';

@Module({
  controllers: [ProfilePublicController],
  providers: [
    ProfilePublicService,
    { provide: PROFILE_PUBLIC_READ_REPOSITORY, useClass: PrismaProfilePublicReadRepository },
  ],
})
export class ProfileModule {}
