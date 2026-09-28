import type { SupportedLocale } from '../../../shared/domain/locale';
import type { PublicationStatus } from '../../../shared/domain/publication-status';

export interface ArticleTranslation {
  locale: SupportedLocale;
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
}

export interface Article {
  id: string;
  publicationStatus: PublicationStatus;
  authorProfileId: string | null;
  coverMediaId: string | null;
  readingTimeMinutes: number | null;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  translations: ArticleTranslation[];
  tagIds: string[];
}
