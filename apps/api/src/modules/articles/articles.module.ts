import { Module } from '@nestjs/common';
import { ARTICLE_PUBLIC_READ_REPOSITORY } from './application/article-public.types';
import { ArticlesPublicService } from './application/articles-public.service';
import { PrismaArticlePublicReadRepository } from './infrastructure/prisma-article-public-read.repository';
import { ArticlesPublicController } from './presentation/articles-public.controller';

@Module({
  controllers: [ArticlesPublicController],
  providers: [
    ArticlesPublicService,
    { provide: ARTICLE_PUBLIC_READ_REPOSITORY, useClass: PrismaArticlePublicReadRepository },
  ],
})
export class ArticlesModule {}
