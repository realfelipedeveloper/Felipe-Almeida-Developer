import { Injectable } from '@nestjs/common';
import { Prisma, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { toPrismaLocale } from '../../../shared/domain/locale.mapper';
import type {
  NewsListFilters,
  NewsPublicReadRepository,
  PublicNewsDetail,
  PublicNewsListItem,
} from '../application/news-public.types';

const include = {
  translations: true,
  tags: { include: { tag: { include: { translations: true } } } },
} satisfies Prisma.NewsInclude;

@Injectable()
export class PrismaNewsPublicReadRepository implements NewsPublicReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(filters: NewsListFilters): Promise<{ data: PublicNewsListItem[]; total: number }> {
    const locale = toPrismaLocale(filters.locale);
    const where: Prisma.NewsWhereInput = {
      publicationStatus: PublicationStatus.PUBLISHED,
      publishedAt: { lte: new Date() },
      translations: { some: { locale } },
      ...(filters.tag
        ? { tags: { some: { tag: { translations: { some: { locale, slug: filters.tag } } } } } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.news.findMany({
        where,
        include,
        orderBy: { publishedAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.news.count({ where }),
    ]);

    return { data: rows.map((row) => this.toListItem(row, locale)), total };
  }

  async findPublishedBySlug(localeValue: NewsListFilters['locale'], slug: string): Promise<PublicNewsDetail | null> {
    const locale = toPrismaLocale(localeValue);
    const row = await this.prisma.news.findFirst({
      where: {
        publicationStatus: PublicationStatus.PUBLISHED,
        publishedAt: { lte: new Date() },
        translations: { some: { locale, slug } },
      },
      include,
    });

    if (!row) return null;
    const translation = row.translations.find((item) => item.locale === locale);
    if (!translation) return null;

    return {
      ...this.toListItem(row, locale),
      contentHtml: translation.contentHtml,
    };
  }

  private toListItem(
    row: Prisma.NewsGetPayload<{ include: typeof include }>,
    locale: ReturnType<typeof toPrismaLocale>,
  ): PublicNewsListItem {
    const translation = row.translations.find((item) => item.locale === locale);
    if (!translation) throw new Error(`Notícia ${row.id} sem tradução para o locale solicitado.`);

    return {
      id: row.id,
      title: translation.title,
      slug: translation.slug,
      summary: translation.summary,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      coverMediaId: row.coverMediaId,
      tags: row.tags.flatMap(({ tag }) => {
        const translated = tag.translations.find((item) => item.locale === locale);
        return translated ? [{ label: translated.label, slug: translated.slug }] : [];
      }),
    };
  }
}
