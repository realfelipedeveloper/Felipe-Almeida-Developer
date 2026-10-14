import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Locale, MediaKind } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { AppLogger } from '../../../infra/logging/app-logger.service';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import {
  MediaFilePolicyError,
  mediaFileLimitsFromEnvironment,
  type MediaUploadCandidate,
  validateMediaFile,
} from '../domain/media-file-policy';
import { MEDIA_REPOSITORY, type MediaRecord, type MediaRepository } from './media.repository';
import {
  MEDIA_MALWARE_SCANNER,
  MediaMalwareDetectedError,
  type MediaMalwareScanner,
} from './media-malware-scanner';
import { MEDIA_STORAGE, type MediaStorage } from './media-storage';

export interface MediaTranslationInput {
  locale: Locale;
  title: string | null;
  altText: string | null;
}

@Injectable()
export class MediaService {
  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepository,
    @Inject(MEDIA_STORAGE) private readonly storage: MediaStorage,
    @Inject(MEDIA_MALWARE_SCANNER) private readonly malwareScanner: MediaMalwareScanner,
    private readonly logger: AppLogger,
  ) {}

  async upload(candidate: MediaUploadCandidate, admin: AuthenticatedAdmin) {
    let validated;
    try {
      validated = await validateMediaFile(candidate, mediaFileLimitsFromEnvironment());
    } catch (error) {
      if (error instanceof MediaFilePolicyError) throw new BadRequestException(error.message);
      throw error;
    }

    try {
      await this.malwareScanner.scan(validated.content, validated.kind);
    } catch (error) {
      if (error instanceof MediaMalwareDetectedError) throw new BadRequestException(error.message);
      throw new ServiceUnavailableException('A validação antivírus está indisponível.');
    }

    const now = new Date();
    const prefix = validated.kind === 'IMAGE' ? 'image' : 'pdf';
    const key = `${prefix}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${validated.extension}`;

    const pending = await this.repository.createPending(
      {
        kind: validated.kind,
        storageProvider: this.storage.provider,
        storageKey: key,
        originalName: validated.safeOriginalName,
        mimeType: validated.mimeType,
        extension: validated.extension,
        byteSize: BigInt(validated.byteSize),
        sha256: validated.sha256,
        width: validated.width,
        height: validated.height,
        metadata: { origin: 'admin-upload' },
      },
      admin,
    );
    try {
      await this.storage.put(key, validated.content, validated.mimeType, validated.sha256);
      const media = await this.repository.markStorageReady(pending.id, admin);
      return this.serialize(media);
    } catch (error) {
      await this.failPendingUpload(pending.id, key);
      throw error;
    }
  }

  async list(filters: { kind?: MediaKind; page: number; limit: number }) {
    const result = await this.repository.list(filters);
    return {
      data: result.data.map((media) => this.serialize(media)),
      meta: { page: filters.page, limit: filters.limit, total: result.total },
    };
  }

  async updateTranslations(
    id: string,
    translations: MediaTranslationInput[],
    admin: AuthenticatedAdmin,
  ) {
    await this.requireMedia(id);
    if (new Set(translations.map((item) => item.locale)).size !== translations.length) {
      throw new BadRequestException('Cada idioma só pode aparecer uma vez.');
    }
    return this.serialize(await this.repository.replaceTranslations(id, translations, admin));
  }

  async delete(id: string, admin: AuthenticatedAdmin): Promise<void> {
    const media = await this.requireMedia(id);
    this.assertStorageProvider(media);
    const prepared = await this.repository.prepareDeletion(id, admin);
    if (!prepared.found) throw new NotFoundException('Mídia não encontrada.');
    if (prepared.references.total > 0) {
      throw new ConflictException({
        message: 'A mídia não pode ser removida enquanto estiver referenciada.',
        references: prepared.references,
      });
    }
    try {
      await this.storage.delete(media.storageKey);
    } catch (error) {
      this.logger
        .child('seguranca', { mediaId: id })
        .error(
          { erro: error instanceof Error ? error.message : String(error) },
          'Mídia tombada no banco, mas a remoção física falhou; reconciliação necessária',
        );
      throw new ServiceUnavailableException(
        'A mídia foi desativada, mas a limpeza do armazenamento requer reconciliação.',
      );
    }
    try {
      await this.repository.markStorageDeleted(id);
    } catch (error) {
      this.logger
        .child('seguranca', { mediaId: id })
        .error(
          { erro: error instanceof Error ? error.message : String(error) },
          'Objeto removido, mas a confirmação da limpeza não foi persistida',
        );
    }
  }

  async reconcilePendingStorageDeletions(limit = 100) {
    const boundedLimit = Math.min(Math.max(limit, 1), 500);
    const staleBefore = new Date(Date.now() - this.pendingUploadGraceMinutes() * 60 * 1000);
    const pending = await this.repository.listPendingStorageDeletions(boundedLimit, staleBefore);
    let reconciled = 0;
    let failed = 0;
    for (const media of pending) {
      if (media.storageProvider !== this.storage.provider) {
        failed += 1;
        continue;
      }
      try {
        await this.storage.delete(media.storageKey);
        await this.repository.markStorageDeleted(media.id);
        reconciled += 1;
      } catch (error) {
        failed += 1;
        this.logger
          .child('seguranca', { mediaId: media.id })
          .error(
            { erro: error instanceof Error ? error.message : String(error) },
            'Falha na reconciliação da limpeza de mídia',
          );
      }
    }
    return { inspected: pending.length, reconciled, failed };
  }

  async getAdminMedia(id: string): Promise<MediaRecord> {
    return this.requireMedia(id);
  }

  async getPublicMedia(id: string): Promise<MediaRecord> {
    const media = await this.repository.findPublicById(id);
    if (!media) throw new NotFoundException('Mídia não encontrada.');
    return media;
  }

  async open(media: MediaRecord): Promise<Readable> {
    this.assertStorageProvider(media);
    return this.storage.open(media.storageKey);
  }

  private async requireMedia(id: string): Promise<MediaRecord> {
    const media = await this.repository.findActiveById(id);
    if (!media) throw new NotFoundException('Mídia não encontrada.');
    return media;
  }

  private assertStorageProvider(media: MediaRecord): void {
    if (media.storageProvider !== this.storage.provider) {
      throw new ServiceUnavailableException(
        'O provider necessário para esta mídia não está configurado neste ambiente.',
      );
    }
  }

  private pendingUploadGraceMinutes(): number {
    const configured = Number(process.env.MEDIA_PENDING_UPLOAD_GRACE_MINUTES ?? 60);
    return Number.isInteger(configured) && configured >= 15 && configured <= 1440
      ? configured
      : 60;
  }

  private serialize(media: MediaRecord) {
    return {
      id: media.id,
      kind: media.kind,
      originalName: media.originalName,
      mimeType: media.mimeType,
      extension: media.extension,
      byteSize: Number(media.byteSize),
      sha256: media.sha256,
      width: media.width,
      height: media.height,
      createdAt: media.createdAt.toISOString(),
      translations: media.translations,
      url: `/api/media/${media.id}`,
      previewUrl: `/api/admin/media/${media.id}/content`,
    };
  }

  private async failPendingUpload(id: string, key: string): Promise<void> {
    try {
      await this.repository.markUploadFailed(id);
    } catch (error) {
      this.logger
        .child('seguranca', { mediaId: id })
        .error(
          { erro: error instanceof Error ? error.message : String(error) },
          'Falha ao tombar upload incompleto; reconciliação por expiração necessária',
        );
    }
    await this.cleanupFailedUpload(id, key);
  }

  private async cleanupFailedUpload(id: string, key: string): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await this.storage.delete(key);
        try {
          await this.repository.markStorageDeleted(id);
        } catch (error) {
          this.logger
            .child('seguranca', { mediaId: id })
            .error(
              { erro: error instanceof Error ? error.message : String(error) },
              'Objeto de upload incompleto removido sem confirmação persistida',
            );
        }
        return;
      } catch (error) {
        lastError = error;
      }
    }
    this.logger
      .child('seguranca', { mediaId: id, storageKey: key })
      .error(
        { erro: lastError instanceof Error ? lastError.message : String(lastError) },
        'Falha ao remover objeto órfão após erro de persistência',
      );
  }
}
