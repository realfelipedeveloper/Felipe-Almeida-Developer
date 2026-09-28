import type { SupportedLocale } from '../../../../shared/domain/locale';
import type { NewsItem } from '../news';

export const NEWS_REPOSITORY = Symbol('NEWS_REPOSITORY');

export interface NewsRepository {
  findById(id: string): Promise<NewsItem | null>;
  findPublishedBySlug(locale: SupportedLocale, slug: string): Promise<NewsItem | null>;
  save(news: NewsItem): Promise<void>;
  delete(id: string): Promise<void>;
}
