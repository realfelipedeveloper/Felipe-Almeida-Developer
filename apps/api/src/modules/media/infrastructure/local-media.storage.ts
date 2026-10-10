import { Injectable } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import type { MediaStorage } from '../application/media-storage';
import { assertMediaStorageKey } from '../domain/media-storage-key';

@Injectable()
export class LocalMediaStorage implements MediaStorage {
  readonly provider = 'LOCAL' as const;
  private readonly root: string;

  constructor(root = resolve(process.cwd(), process.env.MEDIA_LOCAL_ROOT ?? 'var/media')) {
    this.root = resolve(root);
  }

  async put(key: string, content: Buffer, _mimeType: string, _sha256: string): Promise<void> {
    const target = this.resolveKey(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, { flag: 'wx', mode: 0o640 });
  }

  async open(key: string): Promise<Readable> {
    return createReadStream(this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolveKey(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private resolveKey(key: string): string {
    assertMediaStorageKey(key);
    if (isAbsolute(key)) throw new Error('Chave de mídia inválida.');
    const target = resolve(this.root, key);
    const inside = relative(this.root, target);
    if (!inside || inside.startsWith('..') || isAbsolute(inside)) {
      throw new Error('Chave de mídia inválida.');
    }
    return target;
  }
}
