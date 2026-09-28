import type { SupportedLocale } from '../../../shared/domain/locale';
import type { PublicationStatus } from '../../../shared/domain/publication-status';

export interface NewsTranslation {
  locale: SupportedLocale;
  title: string;
  slug: string;
  summary: string;
  contentHtml: string;
}

export interface NewsItem {
  id: string;
  publicationStatus: PublicationStatus;
  coverMediaId: string | null;
  publishedAt: Date | null;
  translations: NewsTranslation[];
  tagIds: string[];
}
