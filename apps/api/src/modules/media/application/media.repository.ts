import type { Locale, MediaKind, MediaStorageProvider } from '@prisma/client';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export interface MediaTranslationRecord {
  locale: Locale;
  title: string | null;
  altText: string | null;
}

export interface MediaRecord {
  id: string;
  kind: MediaKind;
  storageProvider: MediaStorageProvider;
  storageKey: string;
  originalName: string;
  mimeType: string;
  extension: string | null;
  byteSize: bigint;
  sha256: string;
  width: number | null;
  height: number | null;
  createdAt: Date;
  translations: MediaTranslationRecord[];
}

export interface CreateMediaRecordInput {
  kind: MediaKind;
  storageProvider: MediaStorageProvider;
  storageKey: string;
  originalName: string;
  mimeType: string;
  extension: string;
  byteSize: bigint;
  sha256: string;
  metadata: { origin: 'admin-upload' };
  width: number | null;
  height: number | null;
}

export interface MediaListFilters {
  kind?: MediaKind;
  page: number;
  limit: number;
}

export interface MediaReferenceCounts {
  profileAvatars?: number;
  profileResumes?: number;
  profileGallery?: number;
  projectCovers?: number;
  projectGallery?: number;
  articleCovers?: number;
  newsCovers?: number;
  total: number;
}

export interface ReplaceMediaTranslationsInput {
  locale: Locale;
  title: string | null;
  altText: string | null;
}

export interface PendingStorageDeletion {
  id: string;
  storageProvider: MediaStorageProvider;
  storageKey: string;
}

export interface MediaRepository {
  createPending(input: CreateMediaRecordInput, admin: AuthenticatedAdmin): Promise<MediaRecord>;
  markStorageReady(id: string, admin: AuthenticatedAdmin): Promise<MediaRecord>;
  markUploadFailed(id: string): Promise<void>;
  findActiveById(id: string): Promise<MediaRecord | null>;
  findPublicById(id: string): Promise<MediaRecord | null>;
  list(filters: MediaListFilters): Promise<{ data: MediaRecord[]; total: number }>;
  replaceTranslations(
    id: string,
    translations: ReplaceMediaTranslationsInput[],
    admin: AuthenticatedAdmin,
  ): Promise<MediaRecord>;
  prepareDeletion(
    id: string,
    admin: AuthenticatedAdmin,
  ): Promise<{ found: boolean; references: MediaReferenceCounts }>;
  markStorageDeleted(id: string): Promise<void>;
  listPendingStorageDeletions(limit: number, staleBefore: Date): Promise<PendingStorageDeletion[]>;
}
