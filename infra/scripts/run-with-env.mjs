#!/usr/bin/env node
/**
 * Executa um comando carregando as variáveis do .env da raiz.
 * Evita diferenças de expansão de variáveis entre PowerShell, CMD e shells Unix.
 *
 * Exemplo:
 *   node ../../infra/scripts/run-with-env.mjs next dev -p {WEB_PORT}
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '../..');
const envFile = fs.existsSync(path.join(rootDir, '.env'))
  ? path.join(rootDir, '.env')
  : path.join(rootDir, '.env.example');

function parseEnv(content) {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

const fileEnv = fs.existsSync(envFile) ? parseEnv(fs.readFileSync(envFile, 'utf8')) : {};
const env = { ...fileEnv, ...process.env };
const input = process.argv.slice(2);

if (!input.length) {
  console.error('Uso: run-with-env.mjs <comando> [...args]');
  process.exit(1);
}

const expand = (value) =>
  value.replace(/\{([A-Z0-9_]+)\}/g, (_, key) => {
    if (!(key in env)) throw new Error(`Variável ${key} não encontrada no ambiente.`);
    return env[key];
  });

const [command, ...args] = input.map(expand);
const child = spawn(command, args, {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
