import type { SupportedLocale } from '../../../shared/domain/locale';
import type { PublicationStatus } from '../../../shared/domain/publication-status';

export const PROJECT_LIFECYCLES = [
  'PLANNED',
  'IN_PROGRESS',
  'ACTIVE',
  'COMPLETED',
  'MAINTENANCE',
  'PAUSED',
] as const;

export type ProjectLifecycle = (typeof PROJECT_LIFECYCLES)[number];

export interface ProjectTranslation {
  locale: SupportedLocale;
  title: string;
  slug: string;
  summary: string;
  description: string;
  challenges: string | null;
  solution: string | null;
  results: string | null;
}

export interface Project {
  id: string;
  publicationStatus: PublicationStatus;
  lifecycle: ProjectLifecycle;
  featured: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
  coverMediaId: string | null;
  sortOrder: number;
  publishedAt: Date | null;
  translations: ProjectTranslation[];
  technologyIds: string[];
  tagIds: string[];
}
