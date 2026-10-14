#!/usr/bin/env node
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const MAGIC = Buffer.from('FADBK001');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES;
const [mode, input, output] = process.argv.slice(2);
const passphrase = process.env.BACKUP_ENCRYPTION_PASSPHRASE;

if (!['encrypt', 'decrypt'].includes(mode) || !input || (mode === 'encrypt' && !output)) {
  console.error('Uso: backup-crypto.mjs <encrypt|decrypt> <entrada> [saída]');
  process.exit(1);
}
if (!passphrase || passphrase.length < 32) {
  console.error('BACKUP_ENCRYPTION_PASSPHRASE deve ter ao menos 32 caracteres.');
  process.exit(1);
}

function keyFor(salt) {
  return scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

async function encrypt() {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', keyFor(salt), iv);
  const destination = createWriteStream(output, { flags: 'wx', mode: 0o600 });
  destination.write(Buffer.concat([MAGIC, salt, iv]));
  await pipeline(createReadStream(input), cipher, destination, { end: false });
  destination.end(cipher.getAuthTag());
  await new Promise((resolve, reject) => {
    destination.once('close', resolve);
    destination.once('error', reject);
  });
}

async function decrypt() {
  const handle = await fs.open(input, 'r');
  try {
    const { size } = await handle.stat();
    if (size <= HEADER_BYTES + TAG_BYTES) throw new Error('Backup criptografado está truncado.');

    const header = Buffer.alloc(HEADER_BYTES);
    await handle.read(header, 0, HEADER_BYTES, 0);
    if (!header.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('Formato de backup criptografado inválido.');
    }

    const tag = Buffer.alloc(TAG_BYTES);
    await handle.read(tag, 0, TAG_BYTES, size - TAG_BYTES);
    const salt = header.subarray(MAGIC.length, MAGIC.length + SALT_BYTES);
    const iv = header.subarray(MAGIC.length + SALT_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', keyFor(salt), iv);
    decipher.setAuthTag(tag);
    const destination = output
      ? createWriteStream(output, { flags: 'wx', mode: 0o600 })
      : process.stdout;
    await pipeline(
      createReadStream(input, { start: HEADER_BYTES, end: size - TAG_BYTES - 1 }),
      decipher,
      destination,
    );
  } finally {
    await handle.close();
  }
}

try {
  if (mode === 'encrypt') await encrypt();
  else await decrypt();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
