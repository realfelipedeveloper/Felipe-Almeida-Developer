export interface PublicArticleListItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  readingTimeMinutes: number | null;
  publishedAt: string | null;
  coverMediaId: string | null;
  tags: Array<{ label: string; slug: string }>;
}

export interface PublicArticleDetail extends PublicArticleListItem {
  bodyHtml: string;
  authorProfileId: string | null;
}

export interface ArticleListFilters {
  locale: 'pt-BR' | 'en' | 'es';
  tag?: string;
  page: number;
  limit: number;
}

export interface ArticlePublicReadRepository {
  listPublished(filters: ArticleListFilters): Promise<{ data: PublicArticleListItem[]; total: number }>;
  findPublishedBySlug(locale: ArticleListFilters['locale'], slug: string): Promise<PublicArticleDetail | null>;
}

export const ARTICLE_PUBLIC_READ_REPOSITORY = Symbol('ARTICLE_PUBLIC_READ_REPOSITORY');
