import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Locale } from '@prisma/client';
import { CacheService } from '../../../infra/redis/cache.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { toPrismaLocale } from '../../../shared/domain/locale.mapper';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import type {
  UpdateProfileAdminDto,
  UpsertArticleAdminDto,
  UpsertNewsAdminDto,
  UpsertProjectAdminDto,
} from '../presentation/dto/admin-content.dto';

@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async dashboard() {
    const [projects, articles, news, drafts, audit] = await Promise.all([
      this.prisma.project.count(),
      this.prisma.article.count(),
      this.prisma.news.count(),
      this.prisma.project.count({ where: { publicationStatus: 'DRAFT' } })
        .then(async (projectDrafts) => projectDrafts
          + await this.prisma.article.count({ where: { publicationStatus: 'DRAFT' } })
          + await this.prisma.news.count({ where: { publicationStatus: 'DRAFT' } })),
      this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);
    return { projects, articles, news, drafts, audit };
  }

  async getProfile() {
    const profile = await this.prisma.profile.findFirst({
      orderBy: { createdAt: 'asc' },
      include: { translations: true, socialLinks: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado.');
    return profile;
  }

  async updateProfile(body: UpdateProfileAdminDto, admin: AuthenticatedAdmin) {
    const profile = await this.prisma.profile.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!profile) throw new NotFoundException('Perfil não encontrado.');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.profileTranslation.deleteMany({ where: { profileId: profile.id } });
      await tx.socialLink.deleteMany({ where: { profileId: profile.id } });
      const updated = await tx.profile.update({
        where: { id: profile.id },
        data: {
          publicEmail: body.publicEmail ?? null,
          publicLocation: body.publicLocation ?? null,
          availableForWork: body.availableForWork ?? true,
          avatarMediaId: body.avatarMediaId ?? null,
          resumeMediaId: body.resumeMediaId ?? null,
          translations: {
            create: body.translations.map((item) => ({
              locale: toPrismaLocale(item.locale),
              fullName: item.fullName,
              headline: item.headline,
              summary: item.summary,
              bio: item.bio,
              seoTitle: item.seoTitle ?? null,
              seoDescription: item.seoDescription ?? null,
            })),
          },
          socialLinks: {
            create: body.socialLinks.map((item) => ({
              label: item.label,
              url: item.url,
              iconKey: item.iconKey ?? null,
              sortOrder: item.sortOrder ?? 0,
              visible: item.visible ?? true,
            })),
          },
        },
        include: { translations: true, socialLinks: { orderBy: { sortOrder: 'asc' } } },
      });
      await this.audit(tx, admin, 'PROFILE_UPDATED', 'Profile', profile.id);
      return updated;
    });
    await this.cache.invalidateByPrefix('public:profile:');
    return result;
  }

  listProjects() {
    return this.prisma.project.findMany({
      include: {
        translations: true,
        technologies: { include: { technology: true }, orderBy: { sortOrder: 'asc' } },
        tags: { include: { tag: { include: { translations: true } } } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async getProject(id: string) {
    const row = await this.prisma.project.findUnique({
      where: { id },
      include: { translations: true, technologies: true, tags: true },
    });
    if (!row) throw new NotFoundException('Projeto não encontrado.');
    return row;
  }

  async createProject(body: UpsertProjectAdminDto, admin: AuthenticatedAdmin) {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.project.create({ data: this.projectCreateData(body) });
        await this.audit(tx, admin, 'PROJECT_CREATED', 'Project', created.id);
        return created;
      });
      await this.cache.invalidateByPrefix('public:projects:');
      return this.getProject(row.id);
    } catch (error) {
      this.handleUnique(error, 'Já existe um projeto/tradução com os dados informados.');
    }
  }

  async updateProject(id: string, body: UpsertProjectAdminDto, admin: AuthenticatedAdmin) {
    await this.ensureExists('project', id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.projectTranslation.deleteMany({ where: { projectId: id } });
        await tx.projectTechnology.deleteMany({ where: { projectId: id } });
        await tx.projectTag.deleteMany({ where: { projectId: id } });
        await tx.project.update({ where: { id }, data: this.projectUpdateData(body) });
        await this.audit(tx, admin, 'PROJECT_UPDATED', 'Project', id);
      });
      await this.cache.invalidateByPrefix('public:projects:');
      return this.getProject(id);
    } catch (error) {
      this.handleUnique(error, 'Já existe um projeto/tradução com os dados informados.');
    }
  }

  async deleteProject(id: string, admin: AuthenticatedAdmin) {
    await this.ensureExists('project', id);
    await this.prisma.$transaction(async (tx) => {
      await tx.project.delete({ where: { id } });
      await this.audit(tx, admin, 'PROJECT_DELETED', 'Project', id);
    });
    await this.cache.invalidateByPrefix('public:projects:');
  }

  listArticles() {
    return this.prisma.article.findMany({
      include: { translations: true, tags: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getArticle(id: string) {
    const row = await this.prisma.article.findUnique({
      where: { id },
      include: { translations: true, tags: true },
    });
    if (!row) throw new NotFoundException('Artigo não encontrado.');
    return row;
  }

  async createArticle(body: UpsertArticleAdminDto, admin: AuthenticatedAdmin) {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.article.create({ data: this.articleCreateData(body) });
        await this.audit(tx, admin, 'ARTICLE_CREATED', 'Article', created.id);
        return created;
      });
      await this.cache.invalidateByPrefix('public:articles:');
      return this.getArticle(row.id);
    } catch (error) {
      this.handleUnique(error, 'Já existe um artigo/tradução com os dados informados.');
    }
  }

  async updateArticle(id: string, body: UpsertArticleAdminDto, admin: AuthenticatedAdmin) {
    await this.ensureExists('article', id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.articleTranslation.deleteMany({ where: { articleId: id } });
        await tx.articleTag.deleteMany({ where: { articleId: id } });
        await tx.article.update({ where: { id }, data: this.articleUpdateData(body) });
        await this.audit(tx, admin, 'ARTICLE_UPDATED', 'Article', id);
      });
      await this.cache.invalidateByPrefix('public:articles:');
      return this.getArticle(id);
    } catch (error) {
      this.handleUnique(error, 'Já existe um artigo/tradução com os dados informados.');
    }
  }

  async deleteArticle(id: string, admin: AuthenticatedAdmin) {
    await this.ensureExists('article', id);
    await this.prisma.$transaction(async (tx) => {
      await tx.article.delete({ where: { id } });
      await this.audit(tx, admin, 'ARTICLE_DELETED', 'Article', id);
    });
    await this.cache.invalidateByPrefix('public:articles:');
  }

  listNews() {
    return this.prisma.news.findMany({
      include: { translations: true, tags: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNews(id: string) {
    const row = await this.prisma.news.findUnique({
      where: { id },
      include: { translations: true, tags: true },
    });
    if (!row) throw new NotFoundException('Notícia não encontrada.');
    return row;
  }

  async createNews(body: UpsertNewsAdminDto, admin: AuthenticatedAdmin) {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.news.create({ data: this.newsCreateData(body) });
        await this.audit(tx, admin, 'NEWS_CREATED', 'News', created.id);
        return created;
      });
      await this.cache.invalidateByPrefix('public:news:');
      return this.getNews(row.id);
    } catch (error) {
      this.handleUnique(error, 'Já existe uma notícia/tradução com os dados informados.');
    }
  }

  async updateNews(id: string, body: UpsertNewsAdminDto, admin: AuthenticatedAdmin) {
    await this.ensureExists('news', id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.newsTranslation.deleteMany({ where: { newsId: id } });
        await tx.newsTag.deleteMany({ where: { newsId: id } });
        await tx.news.update({ where: { id }, data: this.newsUpdateData(body) });
        await this.audit(tx, admin, 'NEWS_UPDATED', 'News', id);
      });
      await this.cache.invalidateByPrefix('public:news:');
      return this.getNews(id);
    } catch (error) {
      this.handleUnique(error, 'Já existe uma notícia/tradução com os dados informados.');
    }
  }

  async deleteNews(id: string, admin: AuthenticatedAdmin) {
    await this.ensureExists('news', id);
    await this.prisma.$transaction(async (tx) => {
      await tx.news.delete({ where: { id } });
      await this.audit(tx, admin, 'NEWS_DELETED', 'News', id);
    });
    await this.cache.invalidateByPrefix('public:news:');
  }

  async options() {
    const [technologies, tags] = await Promise.all([
      this.prisma.technology.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.tag.findMany({ include: { translations: true }, orderBy: { key: 'asc' } }),
    ]);
    return { technologies, tags };
  }

  private projectBaseData(body: UpsertProjectAdminDto) {
    return {
      publicationStatus: body.publicationStatus,
      lifecycle: body.lifecycle,
      featured: body.featured,
      startedAt: body.startedAt ? new Date(body.startedAt) : null,
      endedAt: body.endedAt ? new Date(body.endedAt) : null,
      repositoryUrl: body.repositoryUrl ?? null,
      demoUrl: body.demoUrl ?? null,
      coverMediaId: body.coverMediaId ?? null,
      sortOrder: body.sortOrder,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      translations: {
        create: body.translations.map((item) => ({
          locale: toPrismaLocale(item.locale),
          title: item.title,
          slug: item.slug,
          summary: item.summary,
          description: item.description,
          challenges: item.challenges ?? null,
          solution: item.solution ?? null,
          results: item.results ?? null,
          seoTitle: item.seoTitle ?? null,
          seoDescription: item.seoDescription ?? null,
        })),
      },
      technologies: {
        create: body.technologyIds.map((technologyId, index) => ({ technologyId, sortOrder: index })),
      },
      tags: { create: body.tagIds.map((tagId) => ({ tagId })) },
    };
  }

  private projectCreateData(body: UpsertProjectAdminDto): Prisma.ProjectUncheckedCreateInput {
    return this.projectBaseData(body);
  }

  private projectUpdateData(body: UpsertProjectAdminDto): Prisma.ProjectUncheckedUpdateInput {
    return this.projectBaseData(body);
  }

  private articleBaseData(body: UpsertArticleAdminDto) {
    return {
      publicationStatus: body.publicationStatus,
      authorProfileId: body.authorProfileId ?? null,
      coverMediaId: body.coverMediaId ?? null,
      readingTimeMinutes: body.readingTimeMinutes ?? null,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      translations: {
        create: body.translations.map((item) => ({
          locale: toPrismaLocale(item.locale),
          title: item.title,
          slug: item.slug,
          summary: item.summary,
          bodyHtml: item.bodyHtml,
          seoTitle: item.seoTitle ?? null,
          seoDescription: item.seoDescription ?? null,
        })),
      },
      tags: { create: body.tagIds.map((tagId) => ({ tagId })) },
    };
  }

  private articleCreateData(body: UpsertArticleAdminDto): Prisma.ArticleUncheckedCreateInput {
    return this.articleBaseData(body);
  }

  private articleUpdateData(body: UpsertArticleAdminDto): Prisma.ArticleUncheckedUpdateInput {
    return this.articleBaseData(body);
  }

  private newsBaseData(body: UpsertNewsAdminDto) {
    return {
      publicationStatus: body.publicationStatus,
      coverMediaId: body.coverMediaId ?? null,
      publishedAt: body.publishedAt ? new Date(body.publishedAt) : null,
      translations: {
        create: body.translations.map((item) => ({
          locale: toPrismaLocale(item.locale),
          title: item.title,
          slug: item.slug,
          summary: item.summary,
          contentHtml: item.contentHtml,
          seoTitle: item.seoTitle ?? null,
          seoDescription: item.seoDescription ?? null,
        })),
      },
      tags: { create: body.tagIds.map((tagId) => ({ tagId })) },
    };
  }

  private newsCreateData(body: UpsertNewsAdminDto): Prisma.NewsUncheckedCreateInput {
    return this.newsBaseData(body);
  }

  private newsUpdateData(body: UpsertNewsAdminDto): Prisma.NewsUncheckedUpdateInput {
    return this.newsBaseData(body);
  }

  private async ensureExists(kind: 'project' | 'article' | 'news', id: string): Promise<void> {
    const row = kind === 'project'
      ? await this.prisma.project.findUnique({ where: { id }, select: { id: true } })
      : kind === 'article'
        ? await this.prisma.article.findUnique({ where: { id }, select: { id: true } })
        : await this.prisma.news.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new NotFoundException('Conteúdo não encontrado.');
  }

  private async audit(
    tx: Prisma.TransactionClient,
    admin: AuthenticatedAdmin,
    action: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorAdminId: admin.id,
        action,
        resourceType,
        resourceId,
      },
    });
  }

  private handleUnique(error: unknown, message: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException(message);
    }
    throw error;
  }
}
