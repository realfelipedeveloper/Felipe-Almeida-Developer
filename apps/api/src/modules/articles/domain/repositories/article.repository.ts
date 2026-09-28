import type { SupportedLocale } from '../../../../shared/domain/locale';
import type { Article } from '../article';

export const ARTICLE_REPOSITORY = Symbol('ARTICLE_REPOSITORY');

export interface ArticleRepository {
  findById(id: string): Promise<Article | null>;
  findPublishedBySlug(locale: SupportedLocale, slug: string): Promise<Article | null>;
  save(article: Article): Promise<void>;
  delete(id: string): Promise<void>;
}
