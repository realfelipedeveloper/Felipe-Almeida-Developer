import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../../infra/redis/cache.service';
import { toPaginatedResult } from '../../../shared/presentation/pagination-query.dto';
import {
  ARTICLE_PUBLIC_READ_REPOSITORY,
  type ArticlePublicReadRepository,
} from './article-public.types';
import type { ArticleListQueryDto } from '../presentation/article-list-query.dto';

@Injectable()
export class ArticlesPublicService {
  constructor(
    @Inject(ARTICLE_PUBLIC_READ_REPOSITORY)
    private readonly repository: ArticlePublicReadRepository,
    private readonly cache: CacheService,
  ) {}

  async list(query: ArticleListQueryDto) {
    const key = `public:articles:${Buffer.from(JSON.stringify(query)).toString('base64url')}`;
    return this.cache.getOrSet(key, 60, async () => {
      const result = await this.repository.listPublished(query);
      return toPaginatedResult(result.data, result.total, query.page, query.limit);
    });
  }

  async findBySlug(locale: 'pt-BR' | 'en' | 'es', slug: string) {
    return this.cache.getOrSet(`public:articles:${locale}:${slug}`, 120, async () => {
      const article = await this.repository.findPublishedBySlug(locale, slug);
      if (!article) throw new NotFoundException('Artigo não encontrado.');
      return article;
    });
  }
}
