import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { toPrismaLocale } from '../../../shared/domain/locale.mapper';
import type {
  ProfilePublicReadRepository,
  PublicProfile,
} from '../application/profile-public.types';

@Injectable()
export class PrismaProfilePublicReadRepository implements ProfilePublicReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(localeValue: 'pt-BR' | 'en' | 'es'): Promise<PublicProfile | null> {
    const locale = toPrismaLocale(localeValue);
    const row = await this.prisma.profile.findFirst({
      include: {
        translations: { where: { locale } },
        socialLinks: { where: { visible: true }, orderBy: { sortOrder: 'asc' } },
        principles: {
          orderBy: { sortOrder: 'asc' },
          include: { translations: { where: { locale } } },
        },
        galleryMedia: {
          orderBy: { sortOrder: 'asc' },
          include: { mediaAsset: { include: { translations: { where: { locale } } } } },
        },
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
      aboutEyebrow: translation.aboutEyebrow,
      aboutTitle: translation.aboutTitle,
      aboutIntro: translation.aboutIntro,
      aboutPrinciplesTitle: translation.aboutPrinciplesTitle,
      aboutGalleryTitle: translation.aboutGalleryTitle,
      aboutGalleryText: translation.aboutGalleryText,
      aboutResumeLabel: translation.aboutResumeLabel,
      seoTitle: translation.seoTitle,
      seoDescription: translation.seoDescription,
      publicEmail: row.publicEmail,
      publicLocation: row.publicLocation,
      availableForWork: row.availableForWork,
      avatarMediaId: row.avatarMediaId,
      resumeMediaId: row.resumeMediaId,
      principles: row.principles.flatMap((principle) => {
        const localized = principle.translations[0];
        return localized
          ? [
              {
                id: principle.id,
                title: localized.title,
                text: localized.text,
                sortOrder: principle.sortOrder,
              },
            ]
          : [];
      }),
      gallery: row.galleryMedia.map((item) => ({
        mediaId: item.mediaAssetId,
        altText: item.mediaAsset.translations[0]?.altText ?? null,
        sortOrder: item.sortOrder,
      })),
      socialLinks: row.socialLinks.map((link) => ({
        label: link.label,
        url: link.url,
        iconKey: link.iconKey,
        sortOrder: link.sortOrder,
      })),
    };
  }
}
