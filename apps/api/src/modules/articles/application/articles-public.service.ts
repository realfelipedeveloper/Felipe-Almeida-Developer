import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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
  ) {}

  async list(query: ArticleListQueryDto) {
    const result = await this.repository.listPublished(query);
    return toPaginatedResult(result.data, result.total, query.page, query.limit);
  }

  async findBySlug(locale: 'pt-BR' | 'en' | 'es', slug: string) {
    const article = await this.repository.findPublishedBySlug(locale, slug);
    if (!article) throw new NotFoundException('Artigo não encontrado.');
    return article;
  }
}
