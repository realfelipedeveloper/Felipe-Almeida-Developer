#!/usr/bin/env node
/**
 * Verifica se as portas do projeto estão livres antes de subir o ambiente.
 * Uso: pnpm check:ports  |  node infra/scripts/check-ports.mjs --suggest
 */
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env');
const env = { ...process.env };
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const services = [
  ['Web (Next.js)', 'WEB_PORT', 3000],
  ['API (NestJS)', 'API_PORT', 3333],
  ['PostgreSQL', 'POSTGRES_PORT', 5432],
  ['Redis', 'REDIS_PORT', 6379],
  ['RabbitMQ', 'RABBITMQ_PORT', 5672],
  ['RabbitMQ Painel', 'RABBITMQ_UI_PORT', 15672],
  ['Mailpit SMTP', 'MAILPIT_SMTP_PORT', 1025],
  ['Mailpit Painel', 'MAILPIT_UI_PORT', 8025],
];

const isFree = (port) =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '0.0.0.0');
  });

async function nextFree(port) {
  for (let p = port + 1; p < port + 200; p++) if (await isFree(p)) return p;
  return null;
}

const suggest = process.argv.includes('--suggest');
const skipInfra = process.argv.includes('--apps-only');
let busy = 0;

console.log('\n🔎 Verificando portas disponíveis...\n');
for (const [name, key, def] of services) {
  if (skipInfra && !['WEB_PORT', 'API_PORT'].includes(key)) continue;
  const port = Number(env[key] ?? def);
  const free = await isFree(port);
  if (free) {
    console.log(`  ✅ ${name.padEnd(18)} porta ${port} livre`);
  } else {
    busy++;
    const alt = suggest ? await nextFree(port) : null;
    console.log(`  ❌ ${name.padEnd(18)} porta ${port} OCUPADA${alt ? `  → sugestão: ${key}=${alt}` : ''}`);
  }
}

if (busy) {
  console.log(`\n⚠️  ${busy} porta(s) ocupada(s). Ajuste o .env ou rode com --suggest.\n`);
  process.exit(1);
}
console.log('\n🚀 Todas as portas livres.\n');
