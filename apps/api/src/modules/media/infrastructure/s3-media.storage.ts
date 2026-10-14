import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { MediaStorage } from '../application/media-storage';
import { assertMediaStorageKey } from '../domain/media-storage-key';

@Injectable()
export class S3MediaStorage implements MediaStorage {
  readonly provider = 'OBJECT_STORAGE' as const;
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    this.bucket = requiredEnvironment('MEDIA_S3_BUCKET');
    const endpoint = process.env.MEDIA_S3_ENDPOINT?.trim() || undefined;
    if (process.env.NODE_ENV === 'production' && endpoint && !endpoint.startsWith('https://')) {
      throw new Error('MEDIA_S3_ENDPOINT precisa usar HTTPS em produção.');
    }
    this.client = new S3Client({
      region: process.env.MEDIA_S3_REGION?.trim() || 'us-east-1',
      endpoint,
      forcePathStyle: process.env.MEDIA_S3_FORCE_PATH_STYLE === 'true',
    });
  }

  async put(key: string, content: Buffer, mimeType: string, sha256: string): Promise<void> {
    assertMediaStorageKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: mimeType,
        ChecksumSHA256: Buffer.from(sha256, 'hex').toString('base64'),
        Metadata: { sha256 },
        IfNoneMatch: '*',
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async open(key: string): Promise<Readable> {
    assertMediaStorageKey(key);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!response.Body) throw new Error('Objeto de mídia sem conteúdo.');
    return Readable.fromWeb(response.Body.transformToWebStream() as never);
  }

  async delete(key: string): Promise<void> {
    assertMediaStorageKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} é obrigatório para object storage.`);
  return value;
}
