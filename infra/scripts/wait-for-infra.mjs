#!/usr/bin/env node
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

function parseEnv(content) {
  const parsed = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function endpointFromUrl(value, fallbackPort) {
  try {
    const url = new URL(value);
    return { host: url.hostname || '127.0.0.1', port: Number(url.port || fallbackPort) };
  } catch {
    return { host: '127.0.0.1', port: fallbackPort };
  }
}

export function probeTcp(service, connectionTimeoutMs = 1_000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: service.host, port: service.port });
    const finish = (available) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(available);
    };
    socket.setTimeout(connectionTimeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

export async function waitForServices(
  services,
  {
    probe = probeTcp,
    sleep = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
    now = Date.now,
    intervalMs = 1_000,
    timeoutMs = 240_000,
    onWaiting = () => undefined,
  } = {},
) {
  const startedAt = now();
  let unavailable = services;

  while (true) {
    const availability = await Promise.all(
      services.map(async (service) => ({ service, available: await probe(service) })),
    );
    unavailable = availability.filter(({ available }) => !available).map(({ service }) => service);
    if (!unavailable.length) return services;

    if (now() - startedAt >= timeoutMs) {
      const names = unavailable.map(({ name }) => name).join(', ');
      throw new Error(
        `Infraestrutura indisponível após ${Math.ceil(timeoutMs / 1_000)}s: ${names}. Execute pnpm infra:up e tente novamente.`,
      );
    }

    onWaiting(unavailable, now() - startedAt);
    await sleep(intervalMs);
  }
}

async function main() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(scriptDir, '../..');
  const envPath = path.join(rootDir, '.env');
  const fileEnv = fs.existsSync(envPath) ? parseEnv(fs.readFileSync(envPath, 'utf8')) : {};
  const env = { ...fileEnv, ...process.env };

  const database = endpointFromUrl(env.DATABASE_URL, Number(env.POSTGRES_PORT || 5432));
  const redis = endpointFromUrl(env.REDIS_URL, Number(env.REDIS_PORT || 6379));
  const rabbit = endpointFromUrl(env.RABBITMQ_URL, Number(env.RABBITMQ_PORT || 5672));
  const services = [
    { name: 'PostgreSQL', ...database },
    { name: 'Redis', ...redis },
    { name: 'RabbitMQ', ...rabbit },
  ];
  const timeoutMs = Number(env.INFRA_WAIT_TIMEOUT_MS || 240_000);
  let lastReportBucket = -1;

  console.log('\n⏳ Aguardando a infraestrutura local...');
  await waitForServices(services, {
    timeoutMs,
    onWaiting(unavailable, elapsedMs) {
      const bucket = Math.floor(elapsedMs / 10_000);
      if (bucket === lastReportBucket) return;
      lastReportBucket = bucket;
      console.log(`  Aguardando: ${unavailable.map(({ name }) => name).join(', ')}`);
    },
  });
  console.log('✅ PostgreSQL, Redis e RabbitMQ estão aceitando conexões.\n');
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  main().catch((error) => {
    console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
