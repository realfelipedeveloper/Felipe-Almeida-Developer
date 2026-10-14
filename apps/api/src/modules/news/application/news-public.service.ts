import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { toPaginatedResult } from '../../../shared/presentation/pagination-query.dto';
import { NEWS_PUBLIC_READ_REPOSITORY, type NewsPublicReadRepository } from './news-public.types';
import type { NewsListQueryDto } from '../presentation/news-list-query.dto';

@Injectable()
export class NewsPublicService {
  constructor(
    @Inject(NEWS_PUBLIC_READ_REPOSITORY)
    private readonly repository: NewsPublicReadRepository,
  ) {}

  async list(query: NewsListQueryDto) {
    const result = await this.repository.listPublished(query);
    return toPaginatedResult(result.data, result.total, query.page, query.limit);
  }

  async findBySlug(locale: 'pt-BR' | 'en' | 'es', slug: string) {
    const item = await this.repository.findPublishedBySlug(locale, slug);
    if (!item) throw new NotFoundException('Notícia não encontrada.');
    return item;
  }
}
