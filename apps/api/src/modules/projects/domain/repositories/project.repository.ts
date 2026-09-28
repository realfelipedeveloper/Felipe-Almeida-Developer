import type { SupportedLocale } from '../../../../shared/domain/locale';
import type { Project } from '../project';

export const PROJECT_REPOSITORY = Symbol('PROJECT_REPOSITORY');

export interface ProjectRepository {
  findById(id: string): Promise<Project | null>;
  findPublishedBySlug(locale: SupportedLocale, slug: string): Promise<Project | null>;
  save(project: Project): Promise<void>;
  delete(id: string): Promise<void>;
}
