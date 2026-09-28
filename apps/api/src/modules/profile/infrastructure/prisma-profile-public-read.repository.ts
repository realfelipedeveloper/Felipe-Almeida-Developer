import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { toPrismaLocale } from '../../../shared/domain/locale.mapper';
import type { ProfilePublicReadRepository, PublicProfile } from '../application/profile-public.types';

@Injectable()
export class PrismaProfilePublicReadRepository implements ProfilePublicReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(localeValue: 'pt-BR' | 'en' | 'es'): Promise<PublicProfile | null> {
    const locale = toPrismaLocale(localeValue);
    const row = await this.prisma.profile.findFirst({
      include: {
        translations: { where: { locale } },
        socialLinks: { where: { visible: true }, orderBy: { sortOrder: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!row) return null;
    const translation = row.translations[0];
    if (!translation) return null;

    return {
      id: row.id,
      fullName: translation.fullName,
      headline: translation.headline,
      summary: translation.summary,
      bio: translation.bio,
      publicEmail: row.publicEmail,
      publicLocation: row.publicLocation,
      availableForWork: row.availableForWork,
      avatarMediaId: row.avatarMediaId,
      resumeMediaId: row.resumeMediaId,
      socialLinks: row.socialLinks.map((link) => ({
        label: link.label,
        url: link.url,
        iconKey: link.iconKey,
        sortOrder: link.sortOrder,
      })),
    };
  }
}
