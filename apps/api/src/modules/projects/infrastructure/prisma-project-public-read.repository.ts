import { Injectable } from '@nestjs/common';
import { Prisma, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { toPrismaLocale } from '../../../shared/domain/locale.mapper';
import type {
  ProjectListFilters,
  ProjectPublicReadRepository,
  PublicProjectDetail,
  PublicProjectListItem,
} from '../application/project-public.types';

const listInclude = {
  translations: true,
  technologies: {
    include: { technology: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  tags: {
    include: { tag: { include: { translations: true } } },
  },
} satisfies Prisma.ProjectInclude;

@Injectable()
export class PrismaProjectPublicReadRepository implements ProjectPublicReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(filters: ProjectListFilters): Promise<{ data: PublicProjectListItem[]; total: number }> {
    const locale = toPrismaLocale(filters.locale);
    const where: Prisma.ProjectWhereInput = {
      publicationStatus: PublicationStatus.PUBLISHED,
      translations: { some: { locale } },
      ...(filters.featured === undefined ? {} : { featured: filters.featured }),
      ...(filters.lifecycle ? { lifecycle: filters.lifecycle } : {}),
      ...(filters.technology
        ? { technologies: { some: { technology: { slug: filters.technology } } } }
        : {}),
      ...(filters.tag
        ? { tags: { some: { tag: { translations: { some: { locale, slug: filters.tag } } } } } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.project.findMany({
        where,
        include: listInclude,
        orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { publishedAt: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: rows.map((row) => this.toListItem(row, locale)),
      total,
    };
  }

  async findPublishedBySlug(localeValue: ProjectListFilters['locale'], slug: string): Promise<PublicProjectDetail | null> {
    const locale = toPrismaLocale(localeValue);
    const row = await this.prisma.project.findFirst({
      where: {
        publicationStatus: PublicationStatus.PUBLISHED,
        translations: { some: { locale, slug } },
      },
      include: {
        ...listInclude,
        media: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!row) return null;
    const translation = row.translations.find((item) => item.locale === locale);
    if (!translation) return null;

    return {
      ...this.toListItem(row, locale),
      description: translation.description,
      challenges: translation.challenges,
      solution: translation.solution,
      results: translation.results,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      galleryMediaIds: row.media.map((item) => item.mediaAssetId),
    };
  }

  private toListItem(
    row: Prisma.ProjectGetPayload<{ include: typeof listInclude }>,
    locale: ReturnType<typeof toPrismaLocale>,
  ): PublicProjectListItem {
    const translation = row.translations.find((item) => item.locale === locale);
    if (!translation) {
      throw new Error(`Projeto ${row.id} sem tradução para o locale solicitado.`);
    }

    return {
      id: row.id,
      title: translation.title,
      slug: translation.slug,
      summary: translation.summary,
      lifecycle: row.lifecycle,
      featured: row.featured,
      startedAt: row.startedAt?.toISOString().slice(0, 10) ?? null,
      endedAt: row.endedAt?.toISOString().slice(0, 10) ?? null,
      repositoryUrl: row.repositoryUrl,
      demoUrl: row.demoUrl,
      coverMediaId: row.coverMediaId,
      technologies: row.technologies.map(({ technology }) => ({
        name: technology.name,
        slug: technology.slug,
        category: technology.category,
      })),
      tags: row.tags.flatMap(({ tag }) => {
        const translated = tag.translations.find((item) => item.locale === locale);
        return translated ? [{ label: translated.label, slug: translated.slug }] : [];
      }),
    };
  }
}
