import type { MediaStorageProvider } from '@prisma/client';
import type { Readable } from 'node:stream';

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE');

export interface MediaStorage {
  readonly provider: MediaStorageProvider;
  put(key: string, content: Buffer, mimeType: string, sha256: string): Promise<void>;
  open(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
