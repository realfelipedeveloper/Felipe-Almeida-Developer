import { Module } from '@nestjs/common';
import { PROJECT_PUBLIC_READ_REPOSITORY } from './application/project-public.types';
import { ProjectsPublicService } from './application/projects-public.service';
import { PrismaProjectPublicReadRepository } from './infrastructure/prisma-project-public-read.repository';
import { ProjectsPublicController } from './presentation/projects-public.controller';

@Module({
  controllers: [ProjectsPublicController],
  providers: [
    ProjectsPublicService,
    { provide: PROJECT_PUBLIC_READ_REPOSITORY, useClass: PrismaProjectPublicReadRepository },
  ],
})
export class ProjectsModule {}
