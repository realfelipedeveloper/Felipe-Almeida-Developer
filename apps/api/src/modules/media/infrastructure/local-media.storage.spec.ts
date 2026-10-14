import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalMediaStorage } from './local-media.storage';

describe('LocalMediaStorage', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'fad-media-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('grava, lê e remove somente chaves seguras dentro da raiz', async () => {
    const storage = new LocalMediaStorage(root);
    const buffer = Buffer.from('arquivo');

    const key = 'image/2026/10/55ed9830-d52d-47c4-8755-23522d940f53.png';
    await storage.put(key, buffer, 'image/png', 'checksum');
    await expect(readStream(await storage.open(key))).resolves.toEqual(buffer);
    await expect(
      readFile(join(root, 'image', '2026', '10', '55ed9830-d52d-47c4-8755-23522d940f53.png')),
    ).resolves.toEqual(buffer);

    await storage.delete(key);
    await expect(readStream(await storage.open(key))).rejects.toThrow();
  });

  it.each(['../secret', '/absolute.png', 'image/../../secret', 'image\\evil.png'])(
    'bloqueia traversal ou chave inválida: %s',
    async (key) => {
      const storage = new LocalMediaStorage(root);
      await expect(storage.put(key, Buffer.from('x'), 'image/png', 'checksum')).rejects.toThrow(
        'Chave de mídia inválida',
      );
    },
  );
});

async function readStream(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
