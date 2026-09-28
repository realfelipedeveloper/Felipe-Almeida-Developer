import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../../infra/redis/cache.service';
import { toPaginatedResult } from '../../../shared/presentation/pagination-query.dto';
import { NEWS_PUBLIC_READ_REPOSITORY, type NewsPublicReadRepository } from './news-public.types';
import type { NewsListQueryDto } from '../presentation/news-list-query.dto';

@Injectable()
export class NewsPublicService {
  constructor(
    @Inject(NEWS_PUBLIC_READ_REPOSITORY)
    private readonly repository: NewsPublicReadRepository,
    private readonly cache: CacheService,
  ) {}

  async list(query: NewsListQueryDto) {
    const key = `public:news:${Buffer.from(JSON.stringify(query)).toString('base64url')}`;
    return this.cache.getOrSet(key, 60, async () => {
      const result = await this.repository.listPublished(query);
      return toPaginatedResult(result.data, result.total, query.page, query.limit);
    });
  }

  async findBySlug(locale: 'pt-BR' | 'en' | 'es', slug: string) {
    return this.cache.getOrSet(`public:news:${locale}:${slug}`, 120, async () => {
      const item = await this.repository.findPublishedBySlug(locale, slug);
      if (!item) throw new NotFoundException('Notícia não encontrada.');
      return item;
    });
  }
}
