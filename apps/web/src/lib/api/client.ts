import type { Locale } from '@/i18n/config';
import type {
  ArticleDetail,
  ArticleListItem,
  ContentFilters,
  NewsDetail,
  NewsListItem,
  PaginatedResult,
  ProjectDetail,
  ProjectFilters,
  ProjectListItem,
  PublicProfile,
} from './types';

const API_BASE_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3333';

function emptyPage<T>(page = 1, limit = 12): PaginatedResult<T> {
  return { data: [], pagination: { page, limit, total: 0, totalPages: 0 } };
}

function queryString(values: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 },
    });

    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getProfile(locale: Locale) {
  return apiGet<PublicProfile>(`/api/profile?${queryString({ locale })}`);
}

export async function getProjects(filters: ProjectFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 12;
  return (
    (await apiGet<PaginatedResult<ProjectListItem>>(
      `/api/projects?${queryString({ ...filters, page, limit })}`,
    )) ?? emptyPage<ProjectListItem>(page, limit)
  );
}

export async function getProject(locale: Locale, slug: string) {
  return apiGet<ProjectDetail>(`/api/projects/${encodeURIComponent(slug)}?${queryString({ locale })}`);
}

export async function getArticles(filters: ContentFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 12;
  return (
    (await apiGet<PaginatedResult<ArticleListItem>>(
      `/api/articles?${queryString({ ...filters, page, limit })}`,
    )) ?? emptyPage<ArticleListItem>(page, limit)
  );
}

export async function getArticle(locale: Locale, slug: string) {
  return apiGet<ArticleDetail>(`/api/articles/${encodeURIComponent(slug)}?${queryString({ locale })}`);
}

export async function getNews(filters: ContentFilters) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 12;
  return (
    (await apiGet<PaginatedResult<NewsListItem>>(
      `/api/news?${queryString({ ...filters, page, limit })}`,
    )) ?? emptyPage<NewsListItem>(page, limit)
  );
}

export async function getNewsItem(locale: Locale, slug: string) {
  return apiGet<NewsDetail>(`/api/news/${encodeURIComponent(slug)}?${queryString({ locale })}`);
}
