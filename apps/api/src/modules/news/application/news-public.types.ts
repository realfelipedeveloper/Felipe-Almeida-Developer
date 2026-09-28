export interface PublicNewsListItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  publishedAt: string | null;
  coverMediaId: string | null;
  tags: Array<{ label: string; slug: string }>;
}

export interface PublicNewsDetail extends PublicNewsListItem {
  contentHtml: string;
}

export interface NewsListFilters {
  locale: 'pt-BR' | 'en' | 'es';
  tag?: string;
  page: number;
  limit: number;
}

export interface NewsPublicReadRepository {
  listPublished(filters: NewsListFilters): Promise<{ data: PublicNewsListItem[]; total: number }>;
  findPublishedBySlug(locale: NewsListFilters['locale'], slug: string): Promise<PublicNewsDetail | null>;
}

export const NEWS_PUBLIC_READ_REPOSITORY = Symbol('NEWS_PUBLIC_READ_REPOSITORY');
