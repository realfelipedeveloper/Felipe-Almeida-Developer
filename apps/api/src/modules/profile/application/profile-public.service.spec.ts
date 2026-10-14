import { NotFoundException } from '@nestjs/common';
import type { CacheService } from '../../../infra/redis/cache.service';
import { ProfilePublicService } from './profile-public.service';
import type { ProfilePublicReadRepository } from './profile-public.types';

describe('ProfilePublicService', () => {
  function setup(profile: Awaited<ReturnType<ProfilePublicReadRepository['findPublic']>>) {
    const repository = { findPublic: jest.fn().mockResolvedValue(profile) };
    const cache = {
      getOrSet: jest.fn(async (_key: string, _ttl: number, loader: () => unknown) => loader()),
    };
    return {
      repository,
      cache,
      service: new ProfilePublicService(
        repository as ProfilePublicReadRepository,
        cache as unknown as CacheService,
      ),
    };
  }

  it('carrega o perfil localizado por cache', async () => {
    const profile = { id: 'profile-id', locale: 'pt-BR', name: 'Felipe' } as never;
    const { service, repository, cache } = setup(profile);

    await expect(service.get('pt-BR')).resolves.toBe(profile);
    expect(cache.getOrSet).toHaveBeenCalledWith(
      'public:profile:pt-BR',
      120,
      expect.any(Function),
    );
    expect(repository.findPublic).toHaveBeenCalledWith('pt-BR');
  });

  it('não expõe perfil inexistente', async () => {
    const { service } = setup(null);

    await expect(service.get('es')).rejects.toBeInstanceOf(NotFoundException);
  });
});
