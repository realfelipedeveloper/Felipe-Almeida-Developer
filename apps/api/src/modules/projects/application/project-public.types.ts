import type { ProjectLifecycle } from '../domain/project';

export interface PublicProjectListItem {
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

export interface PublicProjectDetail extends PublicProjectListItem {
  description: string;
  challenges: string | null;
  solution: string | null;
  results: string | null;
  publishedAt: string | null;
  galleryMediaIds: string[];
}

export interface ProjectListFilters {
  locale: 'pt-BR' | 'en' | 'es';
  featured?: boolean;
  lifecycle?: ProjectLifecycle;
  technology?: string;
  tag?: string;
  page: number;
  limit: number;
}

export interface ProjectPublicReadRepository {
  listPublished(filters: ProjectListFilters): Promise<{ data: PublicProjectListItem[]; total: number }>;
  findPublishedBySlug(locale: ProjectListFilters['locale'], slug: string): Promise<PublicProjectDetail | null>;
}

export const PROJECT_PUBLIC_READ_REPOSITORY = Symbol('PROJECT_PUBLIC_READ_REPOSITORY');
