import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../../infra/redis/cache.service';
import { toPaginatedResult } from '../../../shared/presentation/pagination-query.dto';
import {
  PROJECT_PUBLIC_READ_REPOSITORY,
  type ProjectPublicReadRepository,
} from './project-public.types';
import type { ProjectListQueryDto } from '../presentation/project-list-query.dto';

@Injectable()
export class ProjectsPublicService {
  constructor(
    @Inject(PROJECT_PUBLIC_READ_REPOSITORY)
    private readonly repository: ProjectPublicReadRepository,
    private readonly cache: CacheService,
  ) {}

  async list(query: ProjectListQueryDto) {
    const key = `public:projects:${Buffer.from(JSON.stringify(query)).toString('base64url')}`;
    return this.cache.getOrSet(key, 60, async () => {
      const result = await this.repository.listPublished(query);
      return toPaginatedResult(result.data, result.total, query.page, query.limit);
    });
  }

  async findBySlug(locale: 'pt-BR' | 'en' | 'es', slug: string) {
    return this.cache.getOrSet(`public:projects:${locale}:${slug}`, 120, async () => {
      const project = await this.repository.findPublishedBySlug(locale, slug);
      if (!project) {
        throw new NotFoundException('Projeto não encontrado.');
      }
      return project;
    });
  }
}
