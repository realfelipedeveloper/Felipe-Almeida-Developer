import { Module } from '@nestjs/common';
import { NEWS_PUBLIC_READ_REPOSITORY } from './application/news-public.types';
import { NewsPublicService } from './application/news-public.service';
import { PrismaNewsPublicReadRepository } from './infrastructure/prisma-news-public-read.repository';
import { NewsPublicController } from './presentation/news-public.controller';

@Module({
  controllers: [NewsPublicController],
  providers: [
    NewsPublicService,
    { provide: NEWS_PUBLIC_READ_REPOSITORY, useClass: PrismaNewsPublicReadRepository },
  ],
})
export class NewsModule {}
