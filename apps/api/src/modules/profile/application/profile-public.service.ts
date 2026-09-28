import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CacheService } from '../../../infra/redis/cache.service';
import {
  PROFILE_PUBLIC_READ_REPOSITORY,
  type ProfilePublicReadRepository,
} from './profile-public.types';

@Injectable()
export class ProfilePublicService {
  constructor(
    @Inject(PROFILE_PUBLIC_READ_REPOSITORY)
    private readonly repository: ProfilePublicReadRepository,
    private readonly cache: CacheService,
  ) {}

  async get(locale: 'pt-BR' | 'en' | 'es') {
    return this.cache.getOrSet(`public:profile:${locale}`, 120, async () => {
      const profile = await this.repository.findPublic(locale);
      if (!profile) throw new NotFoundException('Perfil público não encontrado.');
      return profile;
    });
  }
}
