import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./backup-crypto.mjs', import.meta.url));
const passphrase = 'segredo-de-teste-com-pelo-menos-32-caracteres';

function execute(args) {
  return spawnSync(process.execPath, [script, ...args], {
    env: { ...process.env, BACKUP_ENCRYPTION_PASSPHRASE: passphrase },
    encoding: 'utf8',
  });
}

test('criptografa, restaura e rejeita backup adulterado', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fad-backup-crypto-'));
  const source = join(directory, 'source.sql.gz');
  const encrypted = join(directory, 'source.sql.gz.aesgcm');
  const restored = join(directory, 'restored.sql.gz');
  const tampered = join(directory, 'tampered.sql.gz.aesgcm');
  const rejected = join(directory, 'rejected.sql.gz');

  try {
    const payload = Buffer.concat([Buffer.from('backup-autenticado\n'), Buffer.alloc(128 * 1024, 0x5a)]);
    await writeFile(source, payload);

    const encryption = execute(['encrypt', source, encrypted]);
    assert.equal(encryption.status, 0, encryption.stderr);

    const decryption = execute(['decrypt', encrypted, restored]);
    assert.equal(decryption.status, 0, decryption.stderr);
    assert.deepEqual(await readFile(restored), payload);

    const altered = await readFile(encrypted);
    altered[Math.floor(altered.length / 2)] ^= 1;
    await writeFile(tampered, altered);
    const rejection = execute(['decrypt', tampered, rejected]);
    assert.notEqual(rejection.status, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
