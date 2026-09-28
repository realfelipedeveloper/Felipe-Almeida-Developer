import type { Locale } from '@/i18n/config';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: Pagination;
}

export type ProjectLifecycle = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'MAINTENANCE' | 'ARCHIVED';

export interface ProjectListItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  lifecycle: ProjectLifecycle;
  featured: boolean;
  startedAt: string | null;
  endedAt: string | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
  coverMediaId: string | null;
  technologies: Array<{ name: string; slug: string; category: string | null }>;
  tags: Array<{ label: string; slug: string }>;
}

export interface ProjectDetail extends ProjectListItem {
  description: string;
  challenges: string | null;
  solution: string | null;
  results: string | null;
  publishedAt: string | null;
  galleryMediaIds: string[];
}

export interface ArticleListItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  readingTimeMinutes: number | null;
  publishedAt: string | null;
  coverMediaId: string | null;
  tags: Array<{ label: string; slug: string }>;
}

export interface ArticleDetail extends ArticleListItem {
  bodyHtml: string;
  authorProfileId: string | null;
}

export interface NewsListItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  publishedAt: string | null;
  coverMediaId: string | null;
  tags: Array<{ label: string; slug: string }>;
}

export interface NewsDetail extends NewsListItem {
  contentHtml: string;
}

export interface PublicProfile {
  id: string;
  fullName: string;
  headline: string;
  summary: string;
  bio: string;
  publicEmail: string | null;
  publicLocation: string | null;
  availableForWork: boolean;
  avatarMediaId: string | null;
  resumeMediaId: string | null;
  socialLinks: Array<{
    label: string;
    url: string;
    iconKey: string | null;
    sortOrder: number;
  }>;
}

export interface ProjectFilters {
  locale: Locale;
  page?: number;
  limit?: number;
  featured?: boolean;
  lifecycle?: ProjectLifecycle;
  technology?: string;
  tag?: string;
}

export interface ContentFilters {
  locale: Locale;
  page?: number;
  limit?: number;
  tag?: string;
}
