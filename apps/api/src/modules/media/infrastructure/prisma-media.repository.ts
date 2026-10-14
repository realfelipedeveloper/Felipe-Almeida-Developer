import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import type {
  CreateMediaRecordInput,
  MediaListFilters,
  MediaRecord,
  MediaReferenceCounts,
  MediaRepository,
  ReplaceMediaTranslationsInput,
  PendingStorageDeletion,
} from '../application/media.repository';

const mediaInclude = { translations: { orderBy: { locale: 'asc' as const } } };

@Injectable()
export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  createPending(input: CreateMediaRecordInput, admin: AuthenticatedAdmin): Promise<MediaRecord> {
    return this.prisma.mediaAsset.create({
      data: {
        kind: input.kind,
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        extension: input.extension,
        byteSize: input.byteSize,
        sha256: input.sha256,
        width: input.width,
        height: input.height,
        createdByAdminId: admin.id,
        metadata: input.metadata,
      },
      include: mediaInclude,
    });
  }

  markStorageReady(id: string, admin: AuthenticatedAdmin): Promise<MediaRecord> {
    return this.prisma.$transaction(async (tx) => {
      const media = await tx.mediaAsset.update({
        where: { id, deletedAt: null, storageReadyAt: null },
        data: { storageReadyAt: new Date() },
        include: mediaInclude,
      });
      await this.audit(tx, admin, 'MEDIA_UPLOADED', id);
      return media;
    });
  }

  async markUploadFailed(id: string): Promise<void> {
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  findActiveById(id: string): Promise<MediaRecord | null> {
    return this.prisma.mediaAsset.findFirst({
      where: { id, deletedAt: null, storageReadyAt: { not: null } },
      include: mediaInclude,
    });
  }

  findPublicById(id: string): Promise<MediaRecord | null> {
    return this.prisma.mediaAsset.findFirst({
      where: {
        id,
        deletedAt: null,
        storageReadyAt: { not: null },
        OR: [
          { profileAvatars: { some: {} } },
          { profileResumes: { some: {} } },
          { profileGallery: { some: {} } },
          { projectCovers: { some: { publicationStatus: 'PUBLISHED' } } },
          { projectMedia: { some: { project: { publicationStatus: 'PUBLISHED' } } } },
          {
            articleCovers: {
              some: {
                publicationStatus: 'PUBLISHED',
                publishedAt: { lte: new Date() },
                OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
              },
            },
          },
          {
            newsCovers: {
              some: {
                publicationStatus: 'PUBLISHED',
                publishedAt: { lte: new Date() },
                OR: [{ scheduledAt: null }, { scheduledAt: { lte: new Date() } }],
              },
            },
          },
        ],
      },
      include: mediaInclude,
    });
  }

  async list(filters: MediaListFilters): Promise<{ data: MediaRecord[]; total: number }> {
    const where: Prisma.MediaAssetWhereInput = {
      deletedAt: null,
      storageReadyAt: { not: null },
      ...(filters.kind ? { kind: filters.kind } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.mediaAsset.findMany({
        where,
        include: mediaInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { data, total };
  }

  async replaceTranslations(
    id: string,
    translations: ReplaceMediaTranslationsInput[],
    admin: AuthenticatedAdmin,
  ): Promise<MediaRecord> {
    return this.prisma.$transaction(async (tx) => {
      await tx.mediaTranslation.deleteMany({ where: { mediaAssetId: id } });
      const media = await tx.mediaAsset.update({
        where: { id, deletedAt: null, storageReadyAt: { not: null } },
        data: {
          translations: {
            create: translations.map((item) => ({
              locale: item.locale,
              title: item.title,
              altText: item.altText,
            })),
          },
        },
        include: mediaInclude,
      });
      await this.audit(tx, admin, 'MEDIA_METADATA_UPDATED', id);
      return media;
    });
  }

  async prepareDeletion(
    id: string,
    admin: AuthenticatedAdmin,
  ): Promise<{ found: boolean; references: MediaReferenceCounts }> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM media_assets
        WHERE id = ${id}::uuid AND deleted_at IS NULL AND storage_ready_at IS NOT NULL
        FOR UPDATE
      `);
      if (!rows.length) return { found: false, references: { total: 0 } };
      const references = await this.referenceCounts(tx, id);
      if (references.total > 0) return { found: true, references };
      await tx.mediaAsset.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit(tx, admin, 'MEDIA_DELETED', id);
      return { found: true, references };
    });
  }

  async markStorageDeleted(id: string): Promise<void> {
    await this.prisma.mediaAsset.update({
      where: { id },
      data: { deletedAt: new Date(), storageDeletedAt: new Date() },
    });
  }

  listPendingStorageDeletions(limit: number, staleBefore: Date): Promise<PendingStorageDeletion[]> {
    return this.prisma.mediaAsset.findMany({
      where: {
        storageDeletedAt: null,
        OR: [
          { deletedAt: { not: null } },
          { storageReadyAt: null, createdAt: { lt: staleBefore } },
        ],
      },
      select: { id: true, storageProvider: true, storageKey: true },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  private async referenceCounts(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<MediaReferenceCounts> {
    const [
      profileAvatars,
      profileResumes,
      profileGallery,
      projectCovers,
      projectGallery,
      articleCovers,
      newsCovers,
    ] = await Promise.all([
      tx.profile.count({ where: { avatarMediaId: id } }),
      tx.profile.count({ where: { resumeMediaId: id } }),
      tx.profileGalleryMedia.count({ where: { mediaAssetId: id } }),
      tx.project.count({ where: { coverMediaId: id } }),
      tx.projectMedia.count({ where: { mediaAssetId: id } }),
      tx.article.count({ where: { coverMediaId: id } }),
      tx.news.count({ where: { coverMediaId: id } }),
    ]);
    return {
      profileAvatars,
      profileResumes,
      profileGallery,
      projectCovers,
      projectGallery,
      articleCovers,
      newsCovers,
      total:
        profileAvatars +
        profileResumes +
        profileGallery +
        projectCovers +
        projectGallery +
        articleCovers +
        newsCovers,
    };
  }

  private async audit(
    tx: Prisma.TransactionClient,
    admin: AuthenticatedAdmin,
    action: string,
    resourceId: string,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        actorAdminId: admin.id,
        action,
        resourceType: 'MediaAsset',
        resourceId,
      },
    });
  }
}
