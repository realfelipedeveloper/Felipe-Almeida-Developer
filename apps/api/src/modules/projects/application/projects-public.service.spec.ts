import { NotFoundException } from '@nestjs/common';
import type { CacheService } from '../../../infra/redis/cache.service';
import type { ProjectListQueryDto } from '../presentation/project-list-query.dto';
import { ProjectsPublicService } from './projects-public.service';
import type { ProjectPublicReadRepository } from './project-public.types';

describe('ProjectsPublicService', () => {
  function setup(result: { data: unknown[]; total: number }, detail: unknown = null) {
    const repository = {
      listPublished: jest.fn().mockResolvedValue(result),
      findPublishedBySlug: jest.fn().mockResolvedValue(detail),
    };
    const cache = {
      getOrSet: jest.fn(async (_key: string, _ttl: number, loader: () => unknown) => loader()),
    };
    return {
      repository,
      cache,
      service: new ProjectsPublicService(
        repository as unknown as ProjectPublicReadRepository,
        cache as unknown as CacheService,
      ),
    };
  }

  it('pagina apenas projetos publicados usando uma chave determinística', async () => {
    const query = { locale: 'pt-BR', page: 2, limit: 6, tag: 'nestjs' } as ProjectListQueryDto;
    const projects = [{ id: 'project-id' }];
    const { service, repository, cache } = setup({ data: projects, total: 7 });

    await expect(service.list(query)).resolves.toEqual({
      data: projects,
      pagination: { page: 2, limit: 6, total: 7, totalPages: 2 },
    });
    expect(repository.listPublished).toHaveBeenCalledWith(query);
    expect(cache.getOrSet).toHaveBeenCalledWith(
      expect.stringMatching(/^public:projects:/),
      60,
      expect.any(Function),
    );
  });

  it('busca o detalhe publicado por locale e slug', async () => {
    const project = { id: 'project-id', slug: 'plataforma' };
    const { service, repository } = setup({ data: [], total: 0 }, project);

    await expect(service.findBySlug('en', 'platform')).resolves.toBe(project);
    expect(repository.findPublishedBySlug).toHaveBeenCalledWith('en', 'platform');
  });

  it('retorna 404 para slug não publicado', async () => {
    const { service } = setup({ data: [], total: 0 });

    await expect(service.findBySlug('es', 'privado')).rejects.toBeInstanceOf(NotFoundException);
  });
});
