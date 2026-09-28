import { Injectable } from '@nestjs/common';
import { Prisma, PublicationStatus } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { toPrismaLocale } from '../../../shared/domain/locale.mapper';
import type {
  ArticleListFilters,
  ArticlePublicReadRepository,
  PublicArticleDetail,
  PublicArticleListItem,
} from '../application/article-public.types';

const include = {
  translations: true,
  tags: { include: { tag: { include: { translations: true } } } },
} satisfies Prisma.ArticleInclude;

@Injectable()
export class PrismaArticlePublicReadRepository implements ArticlePublicReadRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPublished(filters: ArticleListFilters): Promise<{ data: PublicArticleListItem[]; total: number }> {
    const locale = toPrismaLocale(filters.locale);
    const now = new Date();
    const where: Prisma.ArticleWhereInput = {
      publicationStatus: PublicationStatus.PUBLISHED,
      publishedAt: { lte: now },
      translations: { some: { locale } },
      ...(filters.tag
        ? { tags: { some: { tag: { translations: { some: { locale, slug: filters.tag } } } } } }
        : {}),
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.article.findMany({
        where,
        include,
        orderBy: { publishedAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.article.count({ where }),
    ]);

    return { data: rows.map((row) => this.toListItem(row, locale)), total };
  }

  async findPublishedBySlug(localeValue: ArticleListFilters['locale'], slug: string): Promise<PublicArticleDetail | null> {
    const locale = toPrismaLocale(localeValue);
    const row = await this.prisma.article.findFirst({
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
      bodyHtml: translation.bodyHtml,
      authorProfileId: row.authorProfileId,
    };
  }

  private toListItem(
    row: Prisma.ArticleGetPayload<{ include: typeof include }>,
    locale: ReturnType<typeof toPrismaLocale>,
  ): PublicArticleListItem {
    const translation = row.translations.find((item) => item.locale === locale);
    if (!translation) throw new Error(`Artigo ${row.id} sem tradução para o locale solicitado.`);

    return {
      id: row.id,
      title: translation.title,
      slug: translation.slug,
      summary: translation.summary,
      readingTimeMinutes: row.readingTimeMinutes,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      coverMediaId: row.coverMediaId,
      tags: row.tags.flatMap(({ tag }) => {
        const translated = tag.translations.find((item) => item.locale === locale);
        return translated ? [{ label: translated.label, slug: translated.slug }] : [];
      }),
    };
  }
}
